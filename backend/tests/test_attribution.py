import pytest
from app.services.attribution import (
    calculate_haversine_distance,
    classify_ais_gap_severity,
    compute_proximity_score,
    compute_ais_gap_score,
    compute_vessel_type_score,
    compute_trajectory_score,
    compute_attribution_score,
    generate_evidence_summary
)

def test_haversine_distance():
    # Distance between ~ London and Paris ~ 340 km
    d = calculate_haversine_distance(51.5074, -0.1278, 48.8566, 2.3522)
    assert 330 < d < 360

def test_ais_gap_severity_classifier():
    assert classify_ais_gap_severity(0.2) == 0
    assert classify_ais_gap_severity(0.5) == 1
    assert classify_ais_gap_severity(1.9) == 1
    assert classify_ais_gap_severity(2.0) == 2
    assert classify_ais_gap_severity(5.9) == 2
    assert classify_ais_gap_severity(6.0) == 3
    assert classify_ais_gap_severity(12.0) == 3

def test_proximity_score():
    assert compute_proximity_score(0, 50) == 100.0
    assert compute_proximity_score(25, 50) == 50.0
    assert compute_proximity_score(50, 50) == 0.0
    assert compute_proximity_score(60, 50) == 0.0

def test_vessel_type_scoring():
    assert compute_vessel_type_score('Crude Oil Tanker') == 100.0
    assert compute_vessel_type_score('Bulk Carrier') == 80.0
    assert compute_vessel_type_score('Container Ship') == 50.0
    assert compute_vessel_type_score('Fishing Vessel') == 20.0

def test_attribution_formula_weights():
    # Test full 100% case
    score, breakdown = compute_attribution_score(
        proximity=100.0,
        ais_gap=100.0,
        vessel_type=100.0,
        trajectory_alignment=100.0,
        cargo_port_correlation=100.0,
        historical_violation=100.0
    )
    assert score == 100.0
    assert breakdown.proximity == 100.0
    assert breakdown.ais_gap == 100.0

    # Test baseline 0% case
    score0, _ = compute_attribution_score(0, 0, 0, 0, 0, 0)
    assert score0 == 0.0

    # Test realistic combination:
    # prox=80, gap=70 (severity 2), vtype=100 (tanker), traj=100 (strong), cargo=100, hist=0
    # 0.30*80 + 0.25*70 + 0.15*100 + 0.15*100 + 0.10*100 + 0.05*0 = 24 + 17.5 + 15 + 15 + 10 + 0 = 81.5
    score_real, bd_real = compute_attribution_score(80.0, 70.0, 100.0, 100.0, 100.0, 0.0)
    assert score_real == 81.5

def test_evidence_summary_wording_rules():
    summary = generate_evidence_summary(
        vessel_type='Tanker',
        distance_km=4.2,
        gap_hours=5.5,
        trajectory_alignment='strong',
        cargo='Heavy Crude',
        score=84.5
    )
    assert 'Tanker' in summary
    assert '4.2 km' in summary
    assert '5.5 h AIS gap' in summary
    assert 'strong track alignment' in summary
    # Check strict product rules: no legal guilt wording
    assert 'guilty' not in summary.lower()
    assert 'responsible' not in summary.lower()
