import pandas as pd
import numpy as np


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df['time'] = pd.to_datetime(df['time'])
    df = df.sort_values('time')

    df['hour_of_day']  = df['time'].dt.hour
    df['day_of_week']  = df['time'].dt.dayofweek
    df['is_weekend']   = df['day_of_week'].isin([5, 6]).astype(int)
    df['is_night']     = df['hour_of_day'].apply(
        lambda h: 1 if (h >= 23 or h < 6) else 0
    )

    df['temp_delta_1h'] = df['temperature'].diff(periods=2).fillna(0)

    df['motion_count_10'] = df['motion'].astype(int).rolling(
        window=10, min_periods=1
    ).sum()

    df['gas_normalized'] = df['gas_level'].fillna(0) / 4095.0
    df['lux_normalized'] = np.log1p(df['light_lux'].fillna(0)) / 12.0

    feature_columns = FEATURE_NAMES[:]
    for col in feature_columns:
        if col in df.columns:
            df[col] = df[col].fillna(df[col].median())

    return df[feature_columns]


FEATURE_NAMES = [
    'temperature',
    'humidity',
    'gas_normalized',
    'lux_normalized',
    'motion',
    'hour_of_day',
    'day_of_week',
    'is_weekend',
    'is_night',
    'temp_delta_1h',
    'motion_count_10'
]
