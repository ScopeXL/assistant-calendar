#!/bin/bash -e
# pi-gen updates apt's lists in stage0 only: the Docker source added above needs its own.
apt-get update
