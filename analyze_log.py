#!/usr/bin/env python3
import re, json, collections
from datetime import datetime as DT

path = '/Users/thomascahill/Library/Logs/Claude/mcp-server-servalsheets.log'
lines = open(path, 'r', errors='replace').readlines()

def parse_msg(l):
    m = re.match(r'(\S+)\s+\[servalsheets\]\s+\[(info|error|warn)\]\s+Message from (client|server):\s+(\{.*)$', l)
    if not m:
        return None
    ts_s, lvl, side, rest = m.groups()
    # Strip trailing " { metadata: ... }" which is not JSON
    # Find the JSON message by tracking brace depth
    depth = 0
    in_str = False
    esc = False
    end = -1
    for i, ch in enumerate(rest):
        if esc:
            esc = False
            continue
        if ch == '\\':
            esc = True
            continue
        if ch == '"':
            in_str = not in_str
            continue
        if in_str:
            continue
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    if end < 0:
        return None
    js = rest[:end]
    try:
        d = json.loads(js)
    except:
        return None
    return (DT.fromisoformat(ts_s.replace('Z', '+00:00')), side, d)

pending = {}
latencies = []
success_fail = collections.Counter()
tools_used = collections.Counter()
actions_used = collections.Counter()
error_codes = collections.Counter()
error_msgs = collections.Counter()
protocol_versions = collections.Counter()
client_info = collections.Counter()

for l in lines:
    p = parse_msg(l)
    if not p:
        continue
    t, side, d = p
    rid = d.get('id')
    if side == 'client' and 'method' in d:
        method = d.get('method', '')
        if method == 'initialize':
            pv = d.get('params', {}).get('protocolVersion', '')
            protocol_versions[pv] += 1
            ci = d.get('params', {}).get('clientInfo', {})
            client_info[f"{ci.get('name','?')}/{ci.get('version','?')}"] += 1
        if rid is not None:
            name = d.get('params', {}).get('name', '')
            action = (d.get('params', {}).get('arguments', {}) or {}).get('action', '')
            pending[rid] = (t, method, name, action)
            if method == 'tools/call' and name:
                tools_used[name] += 1
                if action:
                    actions_used[f'{name}.{action}'] += 1
    elif side == 'server' and rid in pending:
        t0, method, name, action = pending.pop(rid)
        dur = (t - t0).total_seconds()
        latencies.append((dur, method, name, action))
        result = d.get('result', {})
        if result and 'content' in result:
            for c in result.get('content', []):
                txt = c.get('text', '')
                if '"success": false' in txt or '"success":false' in txt:
                    success_fail[f'{name}.{action}'] += 1
                    m = re.search(r'"code":\s*"([^"]+)"', txt)
                    if m:
                        error_codes[m.group(1)] += 1
                    m2 = re.search(r'"message":\s*"([^"]+)"', txt)
                    if m2:
                        error_msgs[m2.group(1)[:100]] += 1

print('\n=== CLIENT INFO ===')
for ci, c in client_info.most_common():
    print(f'  {c:4d}  {ci}')

print('\n=== PROTOCOL VERSIONS (from initialize) ===')
for pv, c in protocol_versions.most_common():
    print(f'  {c:4d}  {pv}')

print('\n=== LATENCY ===')
print(f'total tool calls: {len(latencies)}')
if latencies:
    print(f'max: {max(latencies)[0]:.2f}s')
    lat_vals = sorted([x[0] for x in latencies])
    print(f'p50: {lat_vals[len(lat_vals)//2]:.3f}s')
    print(f'p95: {lat_vals[int(len(lat_vals)*0.95)]:.3f}s')
    print(f'p99: {lat_vals[int(len(lat_vals)*0.99)]:.3f}s')
    print('\nTop 20 slowest calls:')
    for d, m, n, a in sorted(latencies, reverse=True)[:20]:
        print(f'  {d:7.2f}s  {m:15} {n:22} {a}')

print('\n=== TOOLS USED ===')
for t, c in tools_used.most_common(25):
    print(f'  {c:4d}  {t}')

print('\n=== TOP ACTIONS USED ===')
for a, c in actions_used.most_common(30):
    print(f'  {c:4d}  {a}')

print('\n=== FAILURES BY TOOL.ACTION ===')
for k, v in success_fail.most_common(20):
    print(f'  {v:4d}  {k}')

print('\n=== ERROR CODES ===')
for k, v in error_codes.most_common(30):
    print(f'  {v:4d}  {k}')

print('\n=== TOP ERROR MESSAGES ===')
for k, v in error_msgs.most_common(20):
    print(f'  {v:4d}  {k}')
