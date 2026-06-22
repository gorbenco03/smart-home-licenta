import pandas as pd
import numpy as np


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df['time'] = pd.to_datetime(df['time'])
    df = df.sort_values('time')

    df['hour_of_day'] = df['time'].dt.hour
    df['day_of_week'] = df['time'].dt.dayofweek
    df['is_weekend']  = df['day_of_week'].isin([5, 6]).astype(int)
    df['is_night']    = df['hour_of_day'].apply(
        lambda h: 1 if (h >= 23 or h < 6) else 0
    )

    df['temp_delta_1h'] = df['temperature'].diff(periods=2).fillna(0)

    df['motion_count_10'] = df['motion'].astype(int).rolling(
        window=10, min_periods=1
    ).sum()

    df['gas_normalized'] = df['gas_level'].fillna(0) / 4095.0

    # Luminozitate: se folosea BH1750 (light_lux); înlocuit cu light1 (LDR ADC 0–1023).
    # light1 este stocat în coloana "light_lux" (alias) pentru citirile noi, dar dacă
    # există coloana explicită "light1" aceasta are prioritate.
    # Normalizare log1p pe scara 0–1023 (log1p(1023) ≈ 6.93 → împărțim la 7.0).
    if 'light1' in df.columns:
        raw_light = df['light1'].fillna(df.get('light_lux', pd.Series(0, index=df.index)).fillna(0))
    else:
        raw_light = df['light_lux'].fillna(0)
    df['lux_normalized'] = np.log1p(raw_light) / 7.0

    # Media celor două DHT11 ca feature suplimentar — strategie minim invazivă:
    # dacă temperature2 lipsește (citiri vechi fără al 2-lea senzor), folosim temperature.
    # Aceasta adaugă un singur feature fără a modifica numărul/ordinea celor existente
    # atâta timp cât FEATURE_NAMES este actualizat coerent între train și infer.
    if 'temperature2' in df.columns:
        temp2 = df['temperature2'].fillna(df['temperature'])
    else:
        temp2 = df['temperature']
    df['temp_avg'] = (df['temperature'] + temp2) / 2.0

    feature_columns = FEATURE_NAMES[:]
    for col in feature_columns:
        if col in df.columns:
            df[col] = df[col].fillna(df[col].median())
        else:
            df[col] = 0.0

    return df[feature_columns]


# Ordinea FEATURE_NAMES trebuie să rămână identică între train.py și infer.py.
# Modificare față de versiunea anterioară:
#   - 'lux_normalized' acum se bazează pe light1 (LDR ADC) în loc de BH1750 (light_lux)
#   - adăugat 'temp_avg' (media DHT11 #1 și #2) la finalul listei
FEATURE_NAMES = [
    'temperature',        # DHT11 #1, °C
    'humidity',           # DHT11 #1, %RH
    'gas_normalized',     # MQ-2 ADC / 4095
    'lux_normalized',     # log1p(light1_ADC) / 7.0  [înlocuiește BH1750]
    'motion',             # PIR 0/1
    'hour_of_day',        # 0–23
    'day_of_week',        # 0 (luni) – 6 (duminică)
    'is_weekend',         # 0/1
    'is_night',           # 1 dacă h>=23 sau h<6
    'temp_delta_1h',      # diferența de temperatură față de 2 citiri anterioare
    'motion_count_10',    # număr mișcări în ultimele 10 citiri
    'temp_avg',           # media DHT11 #1 și #2 (fallback = DHT11 #1 dacă #2 lipsește)
]
