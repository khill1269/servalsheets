#!/bin/bash
# Validate Prometheus Alert Rules
# Validates YAML syntax and PromQL expressions in alert rules

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ALERTS_FILE="$PROJECT_ROOT/deployment/prometheus/alerts.yml"

echo "ServalSheets Alert Rules Validation"
echo "===================================="
echo ""

# Check if alerts file exists
if [ ! -f "$ALERTS_FILE" ]; then
    echo "ERROR: Alert rules file not found at $ALERTS_FILE"
    exit 1
fi

echo "Alert file: $ALERTS_FILE"
echo ""

# 1. Validate YAML syntax using Python
echo "1. Validating YAML syntax..."
if command -v python3 &> /dev/null; then
    python3 << EOF
import yaml
import sys

try:
    with open('$ALERTS_FILE', 'r') as f:
        data = yaml.safe_load(f)

    # Check structure
    if 'groups' not in data:
        print("ERROR: Missing 'groups' key in alert rules")
        sys.exit(1)

    groups = data['groups']
    if not isinstance(groups, list):
        print("ERROR: 'groups' must be a list")
        sys.exit(1)

    total_rules = 0
    for group in groups:
        if 'name' not in group:
            print("ERROR: Group missing 'name' field")
            sys.exit(1)
        if 'rules' not in group:
            print(f"ERROR: Group '{group['name']}' missing 'rules' field")
            sys.exit(1)

        rules = group['rules']
        total_rules += len(rules)

        for rule in rules:
            if 'alert' not in rule:
                print(f"ERROR: Rule in group '{group['name']}' missing 'alert' field")
                sys.exit(1)
            if 'expr' not in rule:
                print(f"ERROR: Alert '{rule['alert']}' missing 'expr' field")
                sys.exit(1)
            if 'labels' not in rule:
                print(f"WARNING: Alert '{rule['alert']}' missing 'labels' field")
            if 'annotations' not in rule:
                print(f"WARNING: Alert '{rule['alert']}' missing 'annotations' field")

    print(f"✓ YAML syntax valid")
    print(f"✓ Found {len(groups)} alert groups")
    print(f"✓ Found {total_rules} alert rules")

    # List all groups and their rule counts
    print("")
    print("Alert Groups:")
    for group in groups:
        print(f"  - {group['name']}: {len(group['rules'])} rules")

except yaml.YAMLError as e:
    print(f"ERROR: Invalid YAML syntax: {e}")
    sys.exit(1)
except Exception as e:
    print(f"ERROR: {e}")
    sys.exit(1)
EOF
    if [ $? -ne 0 ]; then
        exit 1
    fi
else
    echo "WARNING: python3 not found, skipping YAML validation"
fi

echo ""
echo "2. Checking alert rule structure..."

# Extract all alert names
ALERT_NAMES=$(python3 << EOF
import yaml
with open('$ALERTS_FILE', 'r') as f:
    data = yaml.safe_load(f)
for group in data['groups']:
    for rule in group['rules']:
        print(rule['alert'])
EOF
)

echo "✓ Found $(echo "$ALERT_NAMES" | wc -l | tr -d ' ') alerts"
echo ""

# 3. Check for required fields in each alert
echo "3. Validating alert rule fields..."
python3 << EOF
import yaml

with open('$ALERTS_FILE', 'r') as f:
    data = yaml.safe_load(f)

issues = []
warnings = []

required_fields = ['alert', 'expr', 'labels', 'annotations']
required_labels = ['severity', 'component']
required_annotations = ['summary', 'description', 'impact', 'action']

for group in data['groups']:
    for rule in group['rules']:
        alert_name = rule.get('alert', 'UNKNOWN')

        # Check required fields
        for field in required_fields:
            if field not in rule:
                issues.append(f"Alert '{alert_name}': Missing required field '{field}'")

        # Check labels
        if 'labels' in rule:
            for label in required_labels:
                if label not in rule['labels']:
                    warnings.append(f"Alert '{alert_name}': Missing recommended label '{label}'")

            # Validate severity
            severity = rule['labels'].get('severity')
            if severity not in ['critical', 'warning', 'info']:
                issues.append(f"Alert '{alert_name}': Invalid severity '{severity}'")

        # Check annotations
        if 'annotations' in rule:
            for annotation in ['summary', 'description']:
                if annotation not in rule['annotations']:
                    issues.append(f"Alert '{alert_name}': Missing required annotation '{annotation}'")

            for annotation in ['impact', 'action']:
                if annotation not in rule['annotations']:
                    warnings.append(f"Alert '{alert_name}': Missing recommended annotation '{annotation}'")

if issues:
    print("ERRORS:")
    for issue in issues:
        print(f"  ✗ {issue}")
    print("")

if warnings:
    print("WARNINGS:")
    for warning in warnings[:10]:  # Limit to first 10
        print(f"  ! {warning}")
    if len(warnings) > 10:
        print(f"  ... and {len(warnings) - 10} more warnings")
    print("")

if not issues:
    print("✓ All alert rules have required fields")

if not issues and not warnings:
    print("✓ All checks passed!")

exit(1 if issues else 0)
EOF

if [ $? -ne 0 ]; then
    echo ""
    echo "Validation found issues. Please fix them before deploying."
    exit 1
fi

echo ""
echo "4. Listing all alerts by severity..."
python3 << EOF
import yaml

with open('$ALERTS_FILE', 'r') as f:
    data = yaml.safe_load(f)

by_severity = {'critical': [], 'warning': [], 'info': []}

for group in data['groups']:
    for rule in group['rules']:
        severity = rule.get('labels', {}).get('severity', 'unknown')
        alert_name = rule['alert']
        component = rule.get('labels', {}).get('component', 'N/A')
        by_severity.setdefault(severity, []).append((alert_name, component))

for severity in ['critical', 'warning', 'info']:
    if severity in by_severity and by_severity[severity]:
        print(f"\n{severity.upper()} ({len(by_severity[severity])} alerts):")
        for alert_name, component in by_severity[severity]:
            print(f"  - {alert_name} [{component}]")
EOF

echo ""
echo "===================================="
echo "Validation completed successfully!"
echo ""
echo "Next steps:"
echo "1. Load rules into Prometheus:"
echo "   docker-compose -f deployment/docker/docker-compose.yml restart prometheus"
echo ""
echo "2. Verify rules loaded:"
echo "   curl http://localhost:9090/api/v1/rules | jq '.data.groups[] | select(.name | startswith(\"servalsheets\"))'"
echo ""
echo "3. Test alerts using Alertmanager API:"
echo "   See docs/guides/MONITORING.md for test scenarios"
echo ""
