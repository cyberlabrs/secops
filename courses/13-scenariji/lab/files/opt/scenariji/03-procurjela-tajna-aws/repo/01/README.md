# izvjestaji-servis

Servis koji svake noći pravi izvještaje iz izvoza kupaca (`kvadrat-kupci-prod/exports/`)
i snima ih u bucket `kvadrat-izvjestaji`.

Pokretanje: `python -m app.export --datum 2026-09-27`
