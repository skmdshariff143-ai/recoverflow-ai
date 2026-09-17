# RecoverFlow AI — Three-Mode Integration Architecture

## 1. Integration Mode Matrix
| Mode | Purpose | Credentials Required | Data Source |
| :--- | :--- | :--- | :--- |
| **DEMO** | Zero-dependency evaluation for judges and recruiters | None | Deterministic synthetic datasets (`dev-payments-200.json`) |
| **SANDBOX** | Real API integration testing against provider testnets | Test API Keys (`rzp_test_*`, Shopify Dev) | Provider sandbox environments |
| **LIVE** | Real merchant production revenue recovery | Production Credentials (Disabled by default) | Real merchant commerce & payment rails |

## 2. Visual & Safety Indicator
All dashboard views, API logs, and case drawers explicitly display the active integration mode badge (`DEMO`, `SANDBOX`, or `LIVE`). Live payment execution is locked behind explicit environment configuration and dual-custody authorization.
