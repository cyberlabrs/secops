# izvjestaji-servis

Servis koji svake noći pravi izvještaje iz izvoza kupaca (`kvadrat-kupci-prod/exports/`)
i snima ih u bucket `kvadrat-izvjestaji`.

Pokretanje: `python -m app.export --datum 2026-09-27`

## Lokalno pokretanje

Kredencijale stavi u `~/.aws/credentials` (profil `izvjestaji`) i pokreni:

```bash
AWS_PROFILE=izvjestaji python -m app.export --datum 2026-10-14
```

Ključeve nikad ne upisuj u `config/settings.py`.
