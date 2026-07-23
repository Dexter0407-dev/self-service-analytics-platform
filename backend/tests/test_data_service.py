import sys
from pathlib import Path

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services.data_service import compute_numeric_stats, compute_outlier_counts


def test_compute_numeric_stats():
    df = pd.DataFrame({"a": [1, 2, 3], "b": ["x", "y", "z"]})
    stats = compute_numeric_stats(df)
    assert "a" in stats
    assert stats["a"]["mean"] == 2.0
    assert "b" not in stats


def test_compute_outlier_counts():
    df = pd.DataFrame({"a": [1, 2, 3, 100]})
    counts = compute_outlier_counts(df)
    assert counts["a"] >= 1
