"""Validate documentation/configuration using only repository fixtures."""

import json
from pathlib import Path

import yaml
from jsonschema import Draft202012Validator

root = Path(__file__).resolve().parents[1]
for path in (root / '.github').rglob('*.yml'):
    assert isinstance(yaml.safe_load(path.read_text()), dict), path
schema = json.loads((root / 'docs/sync.schema.json').read_text())
Draft202012Validator.check_schema(schema)
api = yaml.safe_load((root / 'docs/api.openapi.yml').read_text())
assert api['openapi'] == '3.1.0'
assert set(api['paths']) == {'/api/chat', '/health', '/session', '/objects/{key}'}
container = json.loads((root / '.devcontainer/devcontainer.json').read_text())
assert container['postCreateCommand'] == (
    'npm run setup && npx --no-install playwright install --with-deps chromium'
)
assert container['waitFor'] == 'postCreateCommand'
assert (root / '.devcontainer/smoke.sh').is_file()
print('Workflow, API, artifact, and devcontainer contracts passed')
