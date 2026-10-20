"""The browser's policy (policy.py): what it says, and how it's written for each browser on each
system. Synthetic addresses only."""

from __future__ import annotations

from pathlib import Path

from sunroom_kiosk import policy

ORIGIN = "https://calendar.example.com"


def test_the_policy_quiets_the_browser_and_names_the_sunroom() -> None:
    document = policy.document(ORIGIN)
    assert document["LocalNetworkAccessAllowedForUrls"] == [ORIGIN]
    assert document["LocalNetworkAccessRestrictionsEnabled"] is True
    for key in ("MetricsReportingEnabled", "PasswordManagerEnabled", "TranslateEnabled"):
        assert document[key] is False
    assert document["BrowserSignin"] == 0
    assert "LocalNetworkAccessAllowedForUrls" not in policy.document(None)
    assert policy.valid(document)


def test_linux_paths_per_browser() -> None:
    assert policy.linux_path("chromium") == Path(
        "/etc/chromium/policies/managed/sunroom-kiosk.json"
    )
    assert policy.linux_path("chrome") == Path(
        "/etc/opt/chrome/policies/managed/sunroom-kiosk.json"
    )
    assert policy.linux_path("edge") == Path("/etc/opt/edge/policies/managed/sunroom-kiosk.json")
    assert policy.linux_json(policy.document(ORIGIN)).endswith("}\n")


def test_the_root_helper_accepts_only_known_keys_and_plain_values() -> None:
    assert not policy.valid({"ExtensionInstallForcelist": ["sample"]})
    assert not policy.valid({"LocalNetworkAccessAllowedForUrls": [1]})
    assert not policy.valid({"BrowserSignin": {"nested": True}})
    assert not policy.valid(["not", "an", "object"])


def test_macos_writes_each_setting_with_defaults() -> None:
    commands = policy.mac_commands("chrome", policy.document(ORIGIN))
    assert ["defaults", "write", "com.google.Chrome", "BrowserSignin", "-integer", "0"] in commands
    assert [
        "defaults",
        "write",
        "com.google.Chrome",
        "LocalNetworkAccessAllowedForUrls",
        "-array",
        ORIGIN,
    ] in commands
    assert [
        "defaults",
        "write",
        "com.google.Chrome",
        "TranslateEnabled",
        "-bool",
        "false",
    ] in commands
    assert policy.mac_commands("edge", {"TranslateEnabled": False})[0][2] == "com.microsoft.Edge"


def test_windows_writes_a_list_as_numbered_values() -> None:
    values = policy.windows_values("edge", policy.document(ORIGIN))
    assert (
        r"Software\Policies\Microsoft\Edge\LocalNetworkAccessAllowedForUrls",
        "1",
        "REG_SZ",
        ORIGIN,
    ) in values
    assert (r"Software\Policies\Microsoft\Edge", "BrowserSignin", "REG_DWORD", 0) in values
    assert (r"Software\Policies\Microsoft\Edge", "TranslateEnabled", "REG_DWORD", 0) in values
    assert (
        r"Software\Policies\Microsoft\Edge",
        "LocalNetworkAccessRestrictionsEnabled",
        "REG_DWORD",
        1,
    ) in values
