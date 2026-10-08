"""The CalDAV client (PLAN §8.1, ADR 0005) against two scripted servers: one like Radicale, and
one like iCloud (the principal on one host and the calendars on a pNN host, colors with alpha,
a read-only shared calendar, one UID per account).

Every request goes through the real guarded client and PluginHttp. A fake resolver and httpx's
MockTransport stand in for the network, so no socket is opened."""

from __future__ import annotations

import base64
import logging
import re
from collections.abc import Awaitable, Callable, Mapping, Sequence
from dataclasses import dataclass, field
from urllib.parse import quote, unquote, urlsplit
from xml.etree.ElementTree import Element, SubElement, fromstring, tostring

import httpx
import pytest

from sunroom.core.http import FetchResult, GuardedHttp
from sunroom.core.netguard import NetGuard
from sunroom.plugins.calendar_sync.providers.base import ErrorKind, RemoteCalendar, SyncError
from sunroom.plugins.calendar_sync.providers.caldav import (
    CALDAV_MAX_BYTES,
    NAME_MAX,
    SYNC_ROUNDS,
    CaldavClient,
    Delta,
    SyncCollectionUnsupported,
    SyncTokenInvalid,
    _canonical,
)
from sunroom.plugins.context import PluginHttp

PASSWORD = "test-app-password"
PUBLIC = "93.184.216.34"  # every host resolves here: a public address, so the guard lets it by

D = "DAV:"
C = "urn:ietf:params:xml:ns:caldav"
CS = "http://calendarserver.org/ns/"
ICAL = "http://apple.com/ns/ical/"

DAV_HOST = "dav.example.org"
DAV_URL = f"https://{DAV_HOST}/"
FAMILY = f"https://{DAV_HOST}/ana/family/"
ICLOUD = "caldav.icloud.com"
ICLOUD_POD = "p07-caldav.icloud.com"
POD_HOME = f"https://{ICLOUD_POD}/10000001/calendars/"


def dav(name: str) -> str:
    return f"{{{D}}}{name}"


def cal(name: str) -> str:
    return f"{{{C}}}{name}"


def node(tag: str, *content: Element | str) -> Element:
    element = Element(tag)
    for part in content:
        if isinstance(part, str):
            element.text = part
        else:
            element.append(part)
    return element


def basic(user: str, password: str) -> str:
    return "Basic " + base64.b64encode(f"{user}:{password}".encode()).decode()


def event(uid: str, summary: str = "Sample practice") -> str:
    return (
        "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Sunroom//Tests//EN\r\nBEGIN:VEVENT\r\n"
        f"UID:{uid}\r\nDTSTAMP:20260101T000000Z\r\nSUMMARY:{summary}\r\n"
        "DTSTART:20261010T150000Z\r\nDTEND:20261010T160000Z\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n"
    )


# ---- a scripted CalDAV server ---------------------------------------------------------------


@dataclass
class Item:
    ical: str
    etag: str


@dataclass
class Collection:
    displayname: str | None = None
    color: str | None = None
    components: tuple[str, ...] | None = ("VEVENT",)  # None: the server doesn't say
    privileges: tuple[str, ...] | None = ("read", "write")  # None: the server doesn't say
    kind: str = "calendar"  # or inbox, outbox, subscribed, plain
    items: dict[str, Item] = field(default_factory=dict[str, Item])
    extras: dict[str, str] = field(default_factory=dict[str, str])  # other members: name -> type
    log: dict[str, int] = field(default_factory=dict[str, int])  # name -> revision last changed
    revision: int = 0

    def add(self, name: str, ical: str) -> str:
        self.revision += 1
        self.log[name] = self.revision
        self.items[name] = Item(ical, f'"r{self.revision}"')
        return self.items[name].etag

    def remove(self, name: str) -> None:
        del self.items[name]
        self.revision += 1
        self.log[name] = self.revision


RESOURCETYPES = {
    "calendar": (dav("collection"), cal("calendar")),
    "inbox": (dav("collection"), cal("schedule-inbox")),
    "outbox": (dav("collection"), cal("schedule-outbox")),
    "subscribed": (dav("collection"), f"{{{CS}}}subscribed"),
    "plain": (dav("collection"),),
}


class FakeDav:
    """Enough of a CalDAV server to play Radicale or iCloud: PROPFIND, REPORT (sync-collection
    and calendar-multiget), PUT and DELETE, with Basic auth, etags and a change log."""

    def __init__(
        self,
        *,
        user: str = "ana",
        principal: str = "/ana/",
        home: str = "/ana/",
        home_href: str | None = None,  # how the principal names its home (default: the path)
        home_host: str | None = None,  # the only host that serves the home and its calendars
        well_known: str | None = None,  # where /.well-known/caldav redirects (None: a 404)
        default_namespace: bool = False,  # iCloud's xmlns="DAV:"; otherwise ns0:, ns1: prefixes
        relative: bool = False,  # member hrefs relative to the request's path
        safe: str = "/",  # characters left as they are in hrefs
        sync: bool = True,
        ctag: bool = True,
        token_status: int = 409,
        token_prefix: str = "https://example.org/ns/sync/",  # noqa: S107 - not a password
        page: int | None = None,  # most members in one sync-collection reply (then a 507)
        unique_uids: bool = False,  # iCloud: one UID in one calendar only
    ) -> None:
        self.user = user
        self.password = PASSWORD
        self.principal = principal
        self.home = home
        self.home_href = home_href or home
        self.home_host = home_host
        self.well_known = well_known
        self.default_namespace = default_namespace
        self.relative = relative
        self.safe = safe
        self.sync = sync
        self.ctag = ctag
        self.token_status = token_status
        self.token_prefix = token_prefix
        self.page = page
        self.unique_uids = unique_uids
        self.calendars: dict[str, Collection] = {}
        self.fail_next: list[httpx.Response | None] = []  # canned replies; None: as usual
        self.multiget_sizes: list[int] = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        canned = self.fail_next.pop(0) if self.fail_next else None
        if canned is not None:
            return canned
        path = request.url.path  # decoded
        if path == "/.well-known/caldav":
            if self.well_known is None:
                return httpx.Response(404)
            return httpx.Response(301, headers={"Location": self.well_known})
        if request.headers.get("authorization") != basic(self.user, self.password):
            return httpx.Response(401, headers={"WWW-Authenticate": 'Basic realm="Sample"'})
        if self.home_host and path.startswith(self.home):
            if request.headers["host"] != self.home_host:
                return httpx.Response(404)
        if request.method == "PROPFIND":
            return self.propfind(request, path)
        if request.method == "REPORT":
            return self.report(request, path)
        if request.method == "PUT":
            return self.put(request, path)
        if request.method == "DELETE":
            return self.delete(request, path)
        return httpx.Response(405)

    # replies

    def xml(self, status: int, root: Element) -> httpx.Response:
        text = tostring(root, encoding="unicode")  # DAV: is ns0 (every root is a DAV element)
        if self.default_namespace:  # iCloud's spelling: <multistatus xmlns="DAV:">
            text = text.replace('xmlns:ns0="DAV:"', 'xmlns="DAV:"')
            text = text.replace("<ns0:", "<").replace("</ns0:", "</")
        headers = {"Content-Type": "application/xml; charset=utf-8"}
        return httpx.Response(status, content=text.encode(), headers=headers)

    def error(self, status: int, condition: str) -> httpx.Response:
        return self.xml(status, node(dav("error"), Element(condition)))

    def href(self, path: str, base: str) -> str:
        if self.relative and path != base and path.startswith(base):
            return quote(path[len(base) :], safe=self.safe)
        return quote(path, safe=self.safe)

    def token(self, revision: int) -> str:
        return f"{self.token_prefix}{revision}"

    def since(self, token: str, calendar: Collection) -> int | None:
        number = token.removeprefix(self.token_prefix)
        if token == number or not number.isdigit() or int(number) > calendar.revision:
            return None
        return int(number)

    # PROPFIND

    def props(self, path: str) -> dict[str, Element]:
        props: dict[str, Element] = {}
        collection = node(dav("resourcetype"), Element(dav("collection")))
        if path in ("/", self.principal):
            principal = node(dav("current-user-principal"), node(dav("href"), self.principal))
            props.update({principal.tag: principal, collection.tag: collection})
        if path == self.principal:
            home_set = node(cal("calendar-home-set"), node(dav("href"), self.home_href))
            props[home_set.tag] = home_set
        if path == self.home:
            props[collection.tag] = collection
        if path in self.calendars:
            props.update(self.calendar_props(self.calendars[path]))
        parent = path[: path.rstrip("/").rfind("/") + 1]
        name = path[len(parent) :]
        calendar = self.calendars.get(parent)
        if calendar is not None and name in calendar.items:
            props[dav("getetag")] = node(dav("getetag"), calendar.items[name].etag)
            props[dav("getcontenttype")] = node(
                dav("getcontenttype"), "text/calendar; charset=utf-8"
            )
        elif calendar is not None and name in calendar.extras:
            if name.endswith("/"):
                props[collection.tag] = collection
            else:
                props[dav("getetag")] = node(dav("getetag"), '"x1"')
                props[dav("getcontenttype")] = node(dav("getcontenttype"), calendar.extras[name])
        return props

    def calendar_props(self, calendar: Collection) -> dict[str, Element]:
        kinds = (Element(tag) for tag in RESOURCETYPES[calendar.kind])
        found = [node(dav("resourcetype"), *kinds)]
        if calendar.displayname is not None:
            found.append(node(dav("displayname"), calendar.displayname))
        if calendar.color is not None:
            found.append(node(f"{{{ICAL}}}calendar-color", calendar.color))
        if calendar.components is not None:
            comps = (Element(cal("comp"), {"name": name}) for name in calendar.components)
            found.append(node(cal("supported-calendar-component-set"), *comps))
        if calendar.privileges is not None:
            granted = (node(dav("privilege"), Element(dav(p))) for p in calendar.privileges)
            found.append(node(dav("current-user-privilege-set"), *granted))
        if self.ctag:
            found.append(node(f"{{{CS}}}getctag", f'"ctag-{calendar.revision}"'))
        if self.sync:
            found.append(node(dav("sync-token"), self.token(calendar.revision)))
        return {element.tag: element for element in found}

    def children(self, path: str) -> list[str]:
        if path in self.calendars:
            calendar = self.calendars[path]
            return [path + name for name in [*calendar.items, *calendar.extras]]
        if path == self.home:
            return [other for other in self.calendars if other.startswith(path)]
        return []

    def propfind(self, request: httpx.Request, path: str) -> httpx.Response:
        prop = fromstring(request.content).find(dav("prop"))  # noqa: S314 - the client's own XML
        asked = [child.tag for child in prop] if prop is not None else []
        own = self.props(path)
        if not own:
            return httpx.Response(404)
        root = Element(dav("multistatus"))
        self.respond(root, self.href(path, path), own, asked)
        if request.headers.get("depth") == "1":
            for child in self.children(path):
                self.respond(root, self.href(child, path), self.props(child), asked)
        return self.xml(207, root)

    def respond(
        self, root: Element, href: str, props: dict[str, Element], asked: Sequence[str]
    ) -> None:
        response = SubElement(root, dav("response"))
        SubElement(response, dav("href")).text = href
        found = [props[name] for name in asked if name in props]
        missing = [Element(name) for name in asked if name not in props]
        for elements, status in ((found, "200 OK"), (missing, "404 Not Found")):
            if elements:
                propstat = SubElement(response, dav("propstat"))
                SubElement(propstat, dav("prop")).extend(elements)
                SubElement(propstat, dav("status")).text = f"HTTP/1.1 {status}"

    # REPORT

    def report(self, request: httpx.Request, path: str) -> httpx.Response:
        body = fromstring(request.content)  # noqa: S314 - the client's own XML
        calendar = self.calendars.get(path)
        if calendar is None:
            return httpx.Response(404)
        if body.tag == dav("sync-collection") and self.sync:
            return self.sync_collection(body, path, calendar)
        if body.tag == cal("calendar-multiget"):
            return self.multiget(body, path, calendar)
        return self.error(403, dav("supported-report"))

    def sync_collection(self, body: Element, path: str, calendar: Collection) -> httpx.Response:
        token = (body.findtext(dav("sync-token")) or "").strip()
        if token:
            since = self.since(token, calendar)
            if since is None:
                return self.error(self.token_status, dav("valid-sync-token"))
            entries = sorted((rev, name) for name, rev in calendar.log.items() if rev > since)
        else:
            entries = sorted((calendar.log[name], name) for name in calendar.items)
        truncated = self.page is not None and len(entries) > self.page
        entries = entries[: self.page] if truncated else entries
        root = Element(dav("multistatus"))
        for _revision, name in entries:
            response = SubElement(root, dav("response"))
            SubElement(response, dav("href")).text = self.href(path + name, path)
            if name in calendar.items:
                propstat = SubElement(response, dav("propstat"))
                SubElement(propstat, dav("prop")).append(
                    node(dav("getetag"), calendar.items[name].etag)
                )
                SubElement(propstat, dav("status")).text = "HTTP/1.1 200 OK"
            else:
                SubElement(response, dav("status")).text = "HTTP/1.1 404 Not Found"
        if truncated:
            response = SubElement(root, dav("response"))
            SubElement(response, dav("href")).text = self.href(path, path)
            SubElement(response, dav("status")).text = "HTTP/1.1 507 Insufficient Storage"
        last = entries[-1][0] if truncated else calendar.revision
        SubElement(root, dav("sync-token")).text = self.token(last)
        return self.xml(207, root)

    def multiget(self, body: Element, path: str, calendar: Collection) -> httpx.Response:
        hrefs = body.findall(dav("href"))
        self.multiget_sizes.append(len(hrefs))
        root = Element(dav("multistatus"))
        for href in hrefs:
            wanted = unquote(urlsplit(href.text or "").path)
            item = calendar.items.get(wanted.removeprefix(path))
            response = SubElement(root, dav("response"))
            SubElement(response, dav("href")).text = self.href(wanted, path)
            if item is None:
                SubElement(response, dav("status")).text = "HTTP/1.1 404 Not Found"
                continue
            propstat = SubElement(response, dav("propstat"))
            SubElement(propstat, dav("prop")).extend(
                [node(dav("getetag"), item.etag), node(cal("calendar-data"), item.ical)]
            )
            SubElement(propstat, dav("status")).text = "HTTP/1.1 200 OK"
        return self.xml(207, root)

    # PUT and DELETE

    def put(self, request: httpx.Request, path: str) -> httpx.Response:
        parent, _, name = path.rpartition("/")
        calendar = self.calendars.get(f"{parent}/")
        if calendar is None:
            return httpx.Response(409)
        if not {"write", "write-content", "all"} & set(calendar.privileges or ("write",)):
            return httpx.Response(403)
        existing = calendar.items.get(name)
        if request.headers.get("if-none-match") == "*" and existing is not None:
            return httpx.Response(412)
        if_match = request.headers.get("if-match")
        if if_match is not None and (existing is None or existing.etag != if_match):
            return httpx.Response(412)
        text = request.content.decode()
        if self.unique_uids and self.uid_elsewhere(text, calendar):
            return self.error(403, cal("no-uid-conflict"))
        etag = calendar.add(name, text)
        return httpx.Response(201 if existing is None else 204, headers={"ETag": etag})

    def uid_elsewhere(self, text: str, calendar: Collection) -> bool:
        uid = next(line for line in text.splitlines() if line.startswith("UID:"))
        return any(
            uid in item.ical
            for other in self.calendars.values()
            if other is not calendar
            for item in other.items.values()
        )

    def delete(self, request: httpx.Request, path: str) -> httpx.Response:
        parent, _, name = path.rpartition("/")
        calendar = self.calendars.get(f"{parent}/")
        existing = calendar.items.get(name) if calendar is not None else None
        if calendar is None or existing is None:
            return httpx.Response(404)
        if_match = request.headers.get("if-match")
        if if_match is not None and if_match != existing.etag:
            return httpx.Response(412)
        calendar.remove(name)
        return httpx.Response(204)


# ---- the network and the servers ------------------------------------------------------------

Handler = Callable[[httpx.Request], httpx.Response]


@dataclass
class Net:
    """The fake internet. The guard pins each URL to an address, so the Host header says which
    server was meant; a host with no server can't be reached."""

    hosts: dict[str, Handler]
    addresses: dict[str, str] = field(default_factory=dict[str, str])
    seen: list[httpx.Request] = field(default_factory=list[httpx.Request])

    def http(self) -> PluginHttp:
        async def resolve(host: str, port: int) -> list[str]:
            return [self.addresses.get(host, PUBLIC)]

        def handle(request: httpx.Request) -> httpx.Response:
            self.seen.append(request)
            server = self.hosts.get(request.headers["host"])
            if server is None:
                raise httpx.ConnectError("no route to host", request=request)
            return server(request)

        guarded = GuardedHttp(
            NetGuard(resolver=resolve), transport_factory=lambda: httpx.MockTransport(handle)
        )
        return PluginHttp(guarded, allow_private=False)


class Spy:
    """Any object with PluginHttp's request() will do; this one notes each size cap."""

    def __init__(self, inner: PluginHttp) -> None:
        self.inner = inner
        self.max_bytes: list[int | None] = []

    async def request(
        self,
        method: str,
        url: str,
        *,
        headers: Mapping[str, str] | None = None,
        content: bytes | None = None,
        max_bytes: int | None = None,
        follow_redirects: bool = True,
    ) -> FetchResult:
        self.max_bytes.append(max_bytes)
        return await self.inner.request(
            method,
            url,
            headers=headers,
            content=content,
            max_bytes=max_bytes,
            follow_redirects=follow_redirects,
        )


def radicale_like(
    *,
    sync: bool = True,
    ctag: bool = True,
    page: int | None = None,
    relative: bool = False,
    safe: str = "/",
    token_status: int = 409,
) -> FakeDav:
    server = FakeDav(
        sync=sync, ctag=ctag, page=page, relative=relative, safe=safe, token_status=token_status
    )
    server.calendars["/ana/family/"] = Collection(displayname="Family", color="#FF2968FF")
    server.calendars["/ana/school run/"] = Collection(color="#3a87ad")
    server.calendars["/ana/chores/"] = Collection(displayname="Chores", components=("VTODO",))
    server.calendars["/ana/holidays/"] = Collection(
        displayname="Holidays", components=None, privileges=("read",)
    )
    server.calendars["/ana/inbox/"] = Collection(kind="inbox")
    return server


def icloud_like() -> FakeDav:
    server = FakeDav(
        user="ana@example.com",
        principal="/10000001/principal/",
        home="/10000001/calendars/",
        home_href=f"https://{ICLOUD_POD}:443/10000001/calendars/",
        home_host=ICLOUD_POD,
        well_known=f"https://{ICLOUD}/",
        default_namespace=True,
        token_status=403,
        token_prefix="HwoQEgwAAA",
        unique_uids=True,
    )
    home = "/10000001/calendars/"
    server.calendars[f"{home}home/"] = Collection(
        displayname="Home", color="#1BADF8FF", privileges=("read", "write-content", "bind")
    )
    server.calendars[f"{home}work/"] = Collection(
        displayname="Work", color="#CC73E1FF", privileges=("all",)
    )
    server.calendars[f"{home}shared/"] = Collection(
        displayname="Sample Family",
        color="#FF9500FF",
        privileges=("read", "read-current-user-privilege-set"),
    )
    server.calendars[f"{home}reminders/"] = Collection(
        displayname="Reminders", components=("VTODO",)
    )
    server.calendars[f"{home}inbox/"] = Collection(kind="inbox")
    server.calendars[f"{home}outbox/"] = Collection(kind="outbox")
    server.calendars[f"{home}notification/"] = Collection(kind="plain")
    server.calendars[f"{home}school-feed/"] = Collection(displayname="Feed", kind="subscribed")
    return server


def radicale_client(server: FakeDav, password: str = PASSWORD) -> tuple[CaldavClient, Net]:
    net = Net({DAV_HOST: server})
    return CaldavClient(net.http(), DAV_URL, "ana", password), net


def icloud_client(server: FakeDav, password: str = PASSWORD) -> tuple[CaldavClient, Net]:
    net = Net({ICLOUD: server, ICLOUD_POD: server})
    return CaldavClient(net.http(), f"https://{ICLOUD}", "ana@example.com", password), net


async def failure(call: Awaitable[object]) -> SyncError:
    with pytest.raises(SyncError) as caught:
        await call
    return caught.value


# ---- discovery ------------------------------------------------------------------------------


async def test_discovery_on_a_radicale_like_server() -> None:
    client, net = radicale_client(radicale_like())
    assert await client.discover() == [
        RemoteCalendar(FAMILY, "Family", "#FF2968", read_only=False),
        RemoteCalendar(f"{DAV_URL}ana/school%20run/", "school run", "#3A87AD", read_only=False),
        RemoteCalendar(f"{DAV_URL}ana/holidays/", "Holidays", None, read_only=True),
    ]
    # No /.well-known/caldav here (404), so the address itself names the principal.
    asked = [(request.url.path, request.headers["depth"]) for request in net.seen]
    assert asked == [("/.well-known/caldav", "0"), ("/", "0"), ("/ana/", "0"), ("/ana/", "1")]
    assert {request.headers["authorization"] for request in net.seen} == {basic("ana", PASSWORD)}


async def test_discovery_on_an_icloud_like_server() -> None:
    client, net = icloud_client(icloud_like())
    assert await client.discover() == [
        RemoteCalendar(f"{POD_HOME}home/", "Home", "#1BADF8", read_only=False),
        RemoteCalendar(f"{POD_HOME}work/", "Work", "#CC73E1", read_only=False),
        RemoteCalendar(f"{POD_HOME}shared/", "Sample Family", "#FF9500", read_only=True),
    ]
    # The well-known redirect is followed; the calendars live on the host the home set names.
    asked = [(request.headers["host"], request.url.path) for request in net.seen]
    assert asked == [
        (ICLOUD, "/.well-known/caldav"),
        (ICLOUD, "/"),
        (ICLOUD, "/10000001/principal/"),
        (ICLOUD_POD, "/10000001/calendars/"),
    ]


async def test_a_bare_host_name_is_an_https_address() -> None:
    server = icloud_like()
    net = Net({ICLOUD: server, ICLOUD_POD: server})
    client = CaldavClient(net.http(), ICLOUD, "ana@example.com", PASSWORD)
    assert len(await client.discover()) == 3
    assert repr(client) == f"CaldavClient('{ICLOUD}')"


# ---- changes --------------------------------------------------------------------------------


async def test_an_initial_sync_then_a_delta() -> None:
    server = radicale_like()
    family = server.calendars["/ana/family/"]
    for name in ("a.ics", "b.ics", "c.ics"):
        family.add(name, event(name))
    client, net = radicale_client(server)

    first = await client.sync_collection(FAMILY, None)
    assert first == Delta(
        {f"{FAMILY}a.ics": '"r1"', f"{FAMILY}b.ics": '"r2"', f"{FAMILY}c.ics": '"r3"'},
        [],
        server.token(3),
    )
    request = net.seen[-1]
    assert (request.method, request.headers["depth"]) == ("REPORT", "0")
    body = fromstring(request.content)  # noqa: S314 - the client's own XML
    assert body.findtext(dav("sync-token")) == ""  # an empty token: everything, please
    assert body.findtext(dav("sync-level")) == "1"

    family.add("b.ics", event("b.ics", "Sample practice, moved"))
    family.remove("c.ics")
    family.add("d.ics", event("d.ics"))
    second = await client.sync_collection(FAMILY, first.token)
    assert second == Delta(
        {f"{FAMILY}b.ics": '"r4"', f"{FAMILY}d.ics": '"r6"'}, [f"{FAMILY}c.ics"], server.token(6)
    )
    assert await client.sync_collection(FAMILY, second.token) == Delta({}, [], server.token(6))


async def test_a_truncated_sync_carries_on_with_the_new_token() -> None:
    server = radicale_like(page=2)
    family = server.calendars["/ana/family/"]
    for number in range(5):
        family.add(f"{number}.ics", event(str(number)))
    client, net = radicale_client(server)

    whole = await client.sync_collection(FAMILY, None)
    assert sorted(whole.changed) == sorted(f"{FAMILY}{number}.ics" for number in range(5))
    assert whole.token == server.token(5)
    assert sum(request.method == "REPORT" for request in net.seen) == 3

    # At most SYNC_ROUNDS rounds; the token covers what arrived, and the next sync goes on.
    server.page = 1
    for number in range(5, 30):
        family.add(f"{number}.ics", event(str(number)))
    some = await client.sync_collection(FAMILY, whole.token)
    assert len(some.changed) == SYNC_ROUNDS
    rest = await client.sync_collection(FAMILY, some.token)
    assert len(rest.changed) == 25 - SYNC_ROUNDS
    assert not set(some.changed) & set(rest.changed)
    assert rest.token == server.token(30)


@pytest.mark.parametrize("status", [403, 409])
async def test_a_forgotten_token_asks_for_a_full_listing(status: int) -> None:
    client, _net = radicale_client(radicale_like(token_status=status))
    with pytest.raises(SyncTokenInvalid):
        await client.sync_collection(FAMILY, "https://example.org/ns/sync/999")


@pytest.mark.parametrize("status", [400, 412])
async def test_a_refused_token_also_asks_for_a_full_listing(status: int) -> None:
    server = radicale_like()
    client, _net = radicale_client(server)
    server.fail_next.append(httpx.Response(status))
    with pytest.raises(SyncTokenInvalid):
        await client.sync_collection(FAMILY, server.token(0))


async def test_without_sync_collection_the_etags_are_compared() -> None:
    server = radicale_like(sync=False)
    family = server.calendars["/ana/family/"]
    family.add("a.ics", event("a"))
    family.add("b", event("b"))  # no .ics, but text/calendar
    family.extras["notes.txt"] = "text/plain"
    family.extras["attachments/"] = "collection"
    client, _net = radicale_client(server)

    error = await failure(client.sync_collection(FAMILY, None))
    assert isinstance(error, SyncCollectionUnsupported)
    assert (error.kind, error.code) == (ErrorKind.BAD_DATA, "unsupported")
    assert (
        error.message
        == "This server can't list what changed, so Sunroom compares every event instead."
    )

    assert await client.list_etags(FAMILY) == {f"{FAMILY}a.ics": '"r1"', f"{FAMILY}b": '"r2"'}
    assert await client.ctag(FAMILY) == '"ctag-2"'


async def test_ctag_falls_back_to_the_sync_token_property() -> None:
    server = radicale_like(ctag=False)
    server.calendars["/ana/family/"].add("a.ics", event("a"))
    client, _net = radicale_client(server)
    assert await client.ctag(FAMILY) == server.token(1)
    bare, _net = radicale_client(radicale_like(ctag=False, sync=False))
    assert await bare.ctag(FAMILY) is None


# ---- reads and writes -----------------------------------------------------------------------


async def test_multiget_asks_in_batches_by_href() -> None:
    server = radicale_like()
    family = server.calendars["/ana/family/"]
    for number in range(119):
        family.add(f"event-{number}.ics", event(f"event-{number}"))
    client, net = radicale_client(server)
    hrefs = [f"{FAMILY}event-{number}.ics" for number in range(119)]

    resources = await client.multiget(FAMILY, [*hrefs, f"{FAMILY}gone.ics"])
    assert server.multiget_sizes == [50, 50, 20]
    reports = [request for request in net.seen if request.method == "REPORT"]
    assert {request.headers["depth"] for request in reports} == {"1"}
    assert [resource.href for resource in resources] == hrefs  # the one that's gone is left out
    stored = family.items["event-7.ics"]
    assert resources[7].etag == stored.etag
    assert resources[7].ical.replace("\r\n", "\n") == stored.ical.replace("\r\n", "\n").strip()
    assert await client.multiget(FAMILY, []) == []


async def test_put_creates_then_replaces_with_if_match() -> None:
    server = radicale_like()
    family = server.calendars["/ana/family/"]
    client, net = radicale_client(server)
    href = client.new_href(FAMILY, "sample-1@example.org")
    assert href == f"{FAMILY}sample-1@example.org.ics"

    etag = await client.put(href, event("sample-1@example.org"), etag=None)
    created = net.seen[-1]
    assert created.headers["if-none-match"] == "*"
    assert "if-match" not in created.headers
    assert created.headers["content-type"] == "text/calendar; charset=utf-8"
    assert etag == family.items["sample-1@example.org.ics"].etag

    newer = await client.put(href, event("sample-1@example.org", "Sample recital"), etag=etag)
    assert net.seen[-1].headers["if-match"] == etag
    assert newer == family.items["sample-1@example.org.ics"].etag != etag

    stale = await failure(client.put(href, event("sample-1@example.org"), etag=etag))
    assert stale.kind == ErrorKind.CONFLICT
    assert stale.message == "That event changed on the server since Sunroom last looked."
    taken = await failure(client.put(href, event("sample-1@example.org"), etag=None))
    assert taken.kind == ErrorKind.CONFLICT

    # The server spells the name with %40; the sync hands back the very href that was made.
    assert list((await client.sync_collection(FAMILY, None)).changed) == [href]


async def test_put_sends_crlf_lines() -> None:
    client, net = radicale_client(radicale_like())
    await client.put(client.new_href(FAMILY, "lf"), "BEGIN:VCALENDAR\nEND:VCALENDAR\n", etag=None)
    assert net.seen[-1].content == b"BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n"


async def test_refused_pushes_say_why() -> None:
    client, _net = radicale_client(radicale_like())
    read_only = await failure(
        client.put(client.new_href(f"{DAV_URL}ana/holidays/", "x"), event("x"), etag=None)
    )
    assert read_only.kind == ErrorKind.REFUSED
    assert (
        read_only.message == "The server didn't allow that change. The calendar may be read-only."
    )

    icloud, _net = icloud_client(icloud_like())
    await icloud.put(
        icloud.new_href(f"{POD_HOME}home/", "sample-uid"), event("sample-uid"), etag=None
    )
    twice = await failure(
        icloud.put(
            icloud.new_href(f"{POD_HOME}work/", "sample-uid"), event("sample-uid"), etag=None
        )
    )
    assert twice.kind == ErrorKind.REFUSED
    assert twice.message == "iCloud already has that event in another calendar."


async def test_delete_with_if_match_and_gone_counts_as_done() -> None:
    server = radicale_like()
    family = server.calendars["/ana/family/"]
    etag = family.add("a.ics", event("a"))
    client, net = radicale_client(server)

    stale = await failure(client.delete(f"{FAMILY}a.ics", etag='"r0"'))
    assert stale.kind == ErrorKind.CONFLICT
    await client.delete(f"{FAMILY}a.ics", etag=etag)
    assert net.seen[-1].headers["if-match"] == etag
    assert "a.ics" not in family.items
    await client.delete(f"{FAMILY}a.ics", etag=None)  # a 404: already gone is done
    assert (net.seen[-1].method, "if-match" in net.seen[-1].headers) == ("DELETE", False)


def test_new_hrefs_are_plain_short_and_one_per_uid() -> None:
    client, _net = radicale_client(radicale_like())
    assert client.new_href(FAMILY, "abc-123") == f"{FAMILY}abc-123.ics"
    assert client.new_href(FAMILY.rstrip("/"), "abc-123") == f"{FAMILY}abc-123.ics"
    assert client.new_href(FAMILY, "Sample.1@example.org") == f"{FAMILY}Sample.1@example.org.ics"
    # Servers decode before they check names, so escaping wouldn't help: anything else in a
    # UID (Radicale refuses ":", "?", "," and quotes) turns it into a hash of the whole UID.
    odd_uid = "urn:uuid:a/b?c#d e+f,'*"
    odd = client.new_href(FAMILY, odd_uid).removeprefix(FAMILY)
    assert re.fullmatch(r"urnuuidabcdef-[0-9a-f]{32}\.ics", odd)
    assert client.new_href(FAMILY, odd_uid) == f"{FAMILY}{odd}"  # the same every time
    assert client.new_href(FAMILY, odd_uid + "!") != f"{FAMILY}{odd}"  # one name per UID
    assert client.new_href(FAMILY, "späť").removeprefix(FAMILY).isascii()
    long_a = client.new_href(FAMILY, "x" * 300 + "a")
    long_b = client.new_href(FAMILY, "x" * 300 + "b")
    assert long_a != long_b
    assert len(long_a) - len(FAMILY) <= NAME_MAX + len(".ics")
    hidden = client.new_href(FAMILY, ".hidden")
    assert not hidden.removeprefix(FAMILY).startswith(".")
    assert hidden != client.new_href(FAMILY, "hidden")


# ---- hrefs ----------------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("given", "canonical"),
    [
        ("HTTPS://Dav.Example.org:443/ana/a%40b.ics", "https://dav.example.org/ana/a@b.ics"),
        ("https://dav.example.org/ana/a@b.ics", "https://dav.example.org/ana/a@b.ics"),
        ("http://dav.example.org:80/x", "http://dav.example.org/x"),
        ("https://dav.example.org:8443/x/", "https://dav.example.org:8443/x/"),
        ("https://dav.example.org/a%2fb/c%7e.ics", "https://dav.example.org/a%2Fb/c~.ics"),
        ("https://dav.example.org/school run/", "https://dav.example.org/school%20run/"),
        ("https://dav.example.org/a+b%2bc.ics", "https://dav.example.org/a%2Bb%2Bc.ics"),
        ("https://dav.example.org/caf%E9.ics", "https://dav.example.org/caf%E9.ics"),
        ("https://dav.example.org/x.ics#part", "https://dav.example.org/x.ics"),
    ],
)
def test_each_href_has_one_spelling(given: str, canonical: str) -> None:
    assert _canonical(given) == canonical


@pytest.mark.parametrize("safe", ["/", "/@"])
async def test_relative_and_percent_encoded_hrefs(safe: str) -> None:
    server = radicale_like(relative=True, safe=safe)
    school = server.calendars["/ana/school run/"]
    school.add("drop-off@example.org.ics", event("drop-off@example.org"))
    school.add("späť.ics", event("spat"))
    client, _net = radicale_client(server)
    school_href = f"{DAV_URL}ana/school%20run/"

    assert school_href in [calendar.remote_id for calendar in await client.discover()]
    expected = {f"{school_href}drop-off@example.org.ics", f"{school_href}sp%C3%A4%C5%A5.ics"}
    etags = await client.list_etags(school_href)
    assert set(etags) == expected
    assert set((await client.sync_collection(school_href, None)).changed) == expected
    resources = await client.multiget(school_href, sorted(etags))
    assert {resource.href for resource in resources} == expected
    assert client.new_href(school_href, "drop-off@example.org") in expected


# ---- failures -------------------------------------------------------------------------------


async def test_a_wrong_icloud_password_says_how_to_fix_it() -> None:
    client, net = icloud_client(icloud_like(), password="the-apple-id-password")
    error = await failure(client.discover())
    assert error.kind == ErrorKind.AUTH
    assert error.message == (
        "iCloud said that password isn't right. Make a new app-specific password and try again."
    )
    assert len(net.seen) == 2  # the well-known address and its redirect; nothing more


async def test_a_wrong_password_elsewhere() -> None:
    client, _net = radicale_client(radicale_like(), password="not-the-password")
    for call in (client.discover(), client.sync_collection(FAMILY, None)):
        error = await failure(call)
        assert error.kind == ErrorKind.AUTH
        assert error.message == "The server said that user name or password isn't right."


async def test_rate_limits_say_when_to_try_again() -> None:
    server = icloud_like()
    client, _net = icloud_client(server)
    home = f"{POD_HOME}home/"

    server.fail_next.append(httpx.Response(503, headers={"Retry-After": "120"}))
    error = await failure(client.sync_collection(home, None))
    assert (error.kind, error.retry_after) == (ErrorKind.RATE_LIMITED, 120.0)
    assert error.message == "iCloud asked Sunroom to slow down. It will try again later."

    later = {
        "Retry-After": "Thu, 08 Oct 2026 14:02:00 GMT",
        "Date": "Thu, 08 Oct 2026 14:00:00 GMT",
    }
    server.fail_next.append(httpx.Response(429, headers=later))
    error = await failure(client.multiget(home, [f"{home}a.ics"]))
    assert (error.kind, error.retry_after) == (ErrorKind.RATE_LIMITED, 120.0)

    server.fail_next.append(httpx.Response(500))
    error = await failure(client.ctag(home))
    assert error.kind == ErrorKind.UNREACHABLE
    assert error.message == "iCloud had a problem. Sunroom will try again later."


async def test_servers_that_dont_answer() -> None:
    nowhere = Net({})
    icloud = CaldavClient(nowhere.http(), f"https://{ICLOUD}", "ana@example.com", PASSWORD)
    error = await failure(icloud.discover())
    assert error.kind == ErrorKind.UNREACHABLE
    assert error.message == "iCloud didn't answer. Check the server has internet and try again."
    assert len(nowhere.seen) == 1  # the address itself is the same server: not asked again

    other = CaldavClient(nowhere.http(), DAV_URL, "ana", PASSWORD)
    error = await failure(other.sync_collection(FAMILY, None))
    assert (error.kind, error.message) == (
        ErrorKind.UNREACHABLE,
        "That server couldn't be reached.",
    )


async def test_a_server_on_the_home_network_needs_the_opt_in() -> None:
    net = Net({DAV_HOST: radicale_like()}, addresses={DAV_HOST: "10.0.0.5"})
    client = CaldavClient(net.http(), DAV_URL, "ana", PASSWORD)
    error = await failure(client.discover())
    assert error.kind == ErrorKind.UNREACHABLE
    assert error.message.startswith("That address is on your home network.")
    assert net.seen == []


async def test_replies_that_are_not_dav_xml_are_bad_data() -> None:
    server = radicale_like()
    client, _net = radicale_client(server)
    entity = b'<?xml version="1.0"?><!DOCTYPE m [<!ENTITY a "aaaa">]>'
    for body in (b"<multistatus", b"<html>Hello</html>", entity + b'<m xmlns="DAV:">&a;</m>'):
        server.fail_next.append(httpx.Response(207, content=body))
        error = await failure(client.sync_collection(FAMILY, None))
        assert error.kind == ErrorKind.BAD_DATA
        assert error.message == "The server sent a reply Sunroom couldn't read."


@pytest.mark.parametrize(
    "reply",
    [
        httpx.Response(200, text="<html><body>Sample Family</body></html>"),
        httpx.Response(405),
    ],
)
async def test_an_address_that_isnt_a_calendar_server(reply: httpx.Response) -> None:
    net = Net({"www.example.org": lambda _request: reply})
    client = CaldavClient(net.http(), "https://www.example.org/", "ana", PASSWORD)
    error = await failure(client.discover())
    assert error.kind == ErrorKind.NOT_FOUND
    assert (
        error.message == "Sunroom couldn't find calendars at that address. Check it and try again."
    )


async def test_a_calendar_server_sending_junk_while_discovering() -> None:
    server = radicale_like()
    client, _net = radicale_client(server)
    # Junk where a principal should be only means "no principal"; junk in the listing is bad.
    server.fail_next.extend([None, None, None, httpx.Response(207, content=b"<oops")])
    error = await failure(client.discover())
    assert (error.kind, error.message) == (
        ErrorKind.BAD_DATA,
        "The server sent a reply Sunroom couldn't read.",
    )


async def test_a_calendar_that_is_gone() -> None:
    client, _net = radicale_client(radicale_like())
    for call in (
        client.sync_collection(f"{DAV_URL}ana/gone/", None),
        client.list_etags(f"{DAV_URL}ana/gone/"),
    ):
        error = await failure(call)
        assert error.kind == ErrorKind.NOT_FOUND
        assert error.message == "That calendar isn't on the server anymore."


async def test_every_request_carries_the_size_cap() -> None:
    server = radicale_like()
    server.calendars["/ana/family/"].add("a.ics", event("a"))
    spy = Spy(Net({DAV_HOST: server}).http())
    client = CaldavClient(spy, DAV_URL, "ana", PASSWORD)
    await client.discover()
    delta = await client.sync_collection(FAMILY, None)
    await client.multiget(FAMILY, list(delta.changed))
    await client.list_etags(FAMILY)
    await client.ctag(FAMILY)
    etag = await client.put(f"{FAMILY}b.ics", event("b"), etag=None)
    await client.delete(f"{FAMILY}b.ics", etag=etag)
    assert len(spy.max_bytes) == 10  # four to discover, then one for each call
    assert set(spy.max_bytes) == {CALDAV_MAX_BYTES}


async def test_the_password_never_reaches_an_error_or_a_log(
    caplog: pytest.LogCaptureFixture, capsys: pytest.CaptureFixture[str]
) -> None:
    caplog.set_level(logging.DEBUG)
    caplog.set_level(logging.DEBUG, logger="httpx")
    server = radicale_like(page=1)
    for number in range(SYNC_ROUNDS + 1):
        server.calendars["/ana/family/"].add(f"{number}.ics", event(str(number)))
    wrong = "the-wrong-app-password"
    client, _net = radicale_client(server)
    stranger, _net = radicale_client(server, password=wrong)
    unreachable = CaldavClient(Net({}).http(), DAV_URL, "ana", PASSWORD)

    errors: list[Exception] = []

    async def attempt(call: Awaitable[object]) -> None:
        try:
            await call
        except (SyncError, SyncTokenInvalid) as error:
            errors.append(error)

    await attempt(stranger.discover())
    await attempt(stranger.put(f"{FAMILY}0.ics", event("0"), etag=None))
    await attempt(client.sync_collection(FAMILY, None))  # too many rounds: a warning is logged
    await attempt(client.sync_collection(FAMILY, "https://example.org/ns/sync/999"))
    server.fail_next.append(httpx.Response(503, headers={"Retry-After": "5"}))
    await attempt(client.multiget(FAMILY, [f"{FAMILY}0.ics"]))
    await attempt(client.put(f"{FAMILY}0.ics", event("0"), etag='"stale"'))
    await attempt(unreachable.ctag(FAMILY))
    assert len(errors) == 6

    captured = capsys.readouterr()
    logged = caplog.text + captured.out + captured.err
    logged += "".join(repr(record.__dict__) for record in caplog.records)
    assert "caldav.sync_rounds_exhausted" in logged  # the capture sees the client's own log
    said = [part for error in errors for part in (str(error), repr(error), repr(error.args))]
    said += [repr(client), repr(stranger)]
    for password in (PASSWORD, wrong):
        encoded = base64.b64encode(f"ana:{password}".encode()).decode()
        for secret in (password, encoded):
            assert secret not in logged
            assert not [text for text in said if secret in text]
            assert not [text for text in said if "/ana/" in text]  # nor a path
