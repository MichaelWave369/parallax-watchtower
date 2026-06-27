# v0.1.9 Browser-Local Alert Rules

Watchtower now supports browser-local alert rule evaluation.

## What it does

Alert rules evaluate the currently visible signal set and report whether a condition is triggered.

Current rule scopes:

- Local magnitude threshold
- Visible magnitude threshold
- News count threshold

## Defaults

The dashboard starts with three default rules:

- Local M3+
- Visible M5+
- News signals present

## Storage

Rules are stored in the browser with `localStorage`. They are not uploaded to a server.

## No notifications yet

v0.1.9 does not send push notifications, emails, texts, or background alerts. It only evaluates rules while the dashboard is open.

## Guardrail

Rules must remain signal-based and place/lens-based. They must not become person-targeting, hidden tracking, stalking, or private-surveillance workflows.
