import pandas as pd


def dnevni_izvjestaj(df: pd.DataFrame, putanja: str) -> None:
    """Sažetak po gradu i kanalu prodaje, snimljen kao Excel."""
    sazetak = df.groupby(["grad", "kanal"]).agg(kupaca=("id", "count"), promet=("iznos", "sum"))
    sazetak.to_excel(putanja)
