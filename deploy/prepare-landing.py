#!/usr/bin/env python3
"""Prepare a versioned landing overlay; never copies app/backend/config files."""
import argparse, copy, hashlib, html, json, re, shutil
from pathlib import Path

MOUNTS = {
    '/srv/index.html': '/opt/pulsedv-landing/public/current/index.html',
    '/srv/landing-cinematic': '/opt/pulsedv-landing/public',
}

def prepare(source, destination, current, release, tracker):
    source, destination = Path(source), Path(destination)
    if not re.fullmatch(r'[a-f0-9]{12}-[0-9TZ-]+', release):
        raise ValueError('Invalid release name')
    destination.mkdir(parents=True, exist_ok=False)
    prefix = '/landing-cinematic/releases/' + release + '/'
    for name in ['style.css', 'cinema.js', 'capability-icons.js', 'header-ink.js', 'motion-core.js']:
        shutil.copy2(source / name, destination / name)
    shutil.copytree(source / 'assets', destination / 'assets')
    page = (source / 'index.html').read_text()
    page = re.sub(r'(src|href)="assets/', lambda m: m[1] + '="' + prefix + 'assets/', page)
    for name in ['style.css', 'cinema.js', 'capability-icons.js', 'header-ink.js', 'motion-core.js']:
        page = page.replace('="' + name + '"', '="' + prefix + name + '"')
    # Runtime URLs are document-relative in the review proposal.
    for name, needle in [('cinema.js', 'assets/phone-${name}.webp'),
                         ('capability-icons.js', 'assets/capability-${el.dataset.lottie}.json')]:
        path = destination / name
        text = path.read_text()
        if needle not in text:
            raise ValueError('Asset URL contract changed: ' + name)
        path.write_text(text.replace(needle, prefix + needle))
    # Production currently has no /app/. Keep the approved button shape but
    # make its availability explicit rather than publishing a dead link.
    page, count = re.subn(r'<a (class="entry-button entry-pwa".*?) href="https://pulsedv.ru/app/"(.*?)>(.*?)</a>',
        lambda m: '<button ' + m[1] + m[2] + ' type="button" disabled>' +
                  m[3].replace('Работает без VPN', 'Скоро') + '</button>', page, count=1, flags=re.S)
    if count != 1:
        raise ValueError('PWA button contract changed')
    page, count = re.subn(r'(<div class="entry-tooltip"[^>]*id="tip-pwa"[^>]*>).*?(</div>)',
        r'\1<strong>Приложение скоро появится</strong><p>Готовим запуск установки на главный экран. Пока откройте PULSE в Telegram.</p>\2', page, count=1, flags=re.S)
    if count != 1:
        raise ValueError('PWA tooltip contract changed')
    with (destination / 'style.css').open('a') as css:
        css.write('\n.entry-button:disabled{font-family:inherit;cursor:default;opacity:.78;transform:none!important}.entry-button:disabled:active{filter:none}\n')
    # Preserve the existing first-party Telegram attribution contract.
    page = page.replace('href="https://t.me/pulsedvbot?startapp"', 'href="https://t.me/pulsedvbot"')
    page = page.replace('class="social"', 'class="social social-link"')
    if tracker:
        shutil.copy2(tracker, destination / 'acquisition.js')
        page = page.replace('</body>', '<script src="' + prefix + 'acquisition.js" defer></script>\n</body>')
    # Retain the current production SEO graph/canonical/social metadata.
    old = Path(current).read_text()
    seo = re.search(r'<!-- PULSE SEO start -->.*?<!-- PULSE SEO end -->', old, re.S)
    if seo:
        metadata = seo[0]
    else:
        selected = re.findall(r'<meta\b[^>]*(?:property="(?:og:|twitter:)[^"]*"|name="(?:robots|description|twitter:[^"]*)")[^>]*>|<link\b[^>]*rel="canonical"[^>]*>|<title>.*?</title>|<script\s+type="application/ld\+json">.*?</script>', old, re.S)
        metadata = '\n'.join(selected)
        if 'rel="canonical"' not in metadata:
            metadata += '\n<link rel="canonical" href="https://pulsedv.ru/">'
    page = re.sub(r'<title>.*?</title>|<meta name="description"[^>]*>', '', page, flags=re.S)
    page = page.replace('</head>', metadata + '\n<meta name="pulse-landing-release" content="' + html.escape(release) + '">\n</head>')
    (destination / 'index.html').write_text(page)
    # The manifest contains every served file, including fonts and all screens.
    manifest = {str(p.relative_to(destination)): hashlib.sha256(p.read_bytes()).hexdigest()
                for p in sorted(destination.rglob('*')) if p.is_file()}
    return manifest

def read_override(path):
    path = Path(path)
    if not path.exists():
        return {}
    text = path.read_text()
    try:
        result = json.loads(text)
    except json.JSONDecodeError:
        try:
            import yaml
        except ImportError as exc:
            raise ValueError('Для существующего YAML override нужен python3-yaml; исходники и сервисы ещё не изменены.') from exc
        result = yaml.safe_load(text)
    if result is None:
        return {}
    if not isinstance(result, dict):
        raise ValueError('Unsupported Compose override')
    return result

def make_override(existing, output):
    config = copy.deepcopy(read_override(existing))
    web = config.setdefault('services', {}).setdefault('web', {})
    volumes = web.setdefault('volumes', [])
    retained = []
    for v in volumes:
        target = v.get('target') if isinstance(v, dict) else str(v).split(':')[1] if ':' in str(v) else None
        if target in MOUNTS:
            source = v.get('source') if isinstance(v, dict) else str(v).split(':')[0]
            if source != MOUNTS[target]:
                raise ValueError('A different mount already owns ' + target)
        else:
            retained.append(v)
    web['volumes'] = retained + [dict(type='bind', source=source, target=target, read_only=True)
                                 for target, source in MOUNTS.items()]
    Path(output).write_text(json.dumps(config, indent=2) + '\n')

def verify_config(before, after):
    before, after = json.loads(Path(before).read_text()), json.loads(Path(after).read_text())
    for config in [before, after]:
        mounts = config['services']['web'].get('volumes', [])
        for v in mounts:
            if v.get('target') in MOUNTS and v.get('source') != MOUNTS[v['target']]:
                raise ValueError('Conflicting live mount')
    actual = {v['target']:v for v in after['services']['web'].get('volumes', []) if v.get('target') in MOUNTS}
    if set(actual) != set(MOUNTS) or not all(v.get('read_only') for v in actual.values()):
        raise ValueError('The landing override is not loaded read-only')
    for config in [before, after]:
        config['services']['web']['volumes'] = [v for v in config['services']['web'].get('volumes', []) if v.get('target') not in MOUNTS]
    if before != after:
        raise ValueError('Compose changes outside the two landing mounts')

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest='command', required=True)
    p = sub.add_parser('prepare')
    for arg in ['source','destination','current','release','manifest']:
        p.add_argument('--'+arg, required=True)
    p.add_argument('--tracker')
    p = sub.add_parser('override');p.add_argument('existing');p.add_argument('output')
    p = sub.add_parser('verify-config');p.add_argument('before');p.add_argument('after')
    args = parser.parse_args()
    if args.command == 'prepare':
        Path(args.manifest).write_text(json.dumps(prepare(args.source,args.destination,args.current,args.release,args.tracker),indent=2))
    elif args.command == 'override':
        make_override(args.existing,args.output)
    else:
        verify_config(args.before,args.after)
