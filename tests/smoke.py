"""Browser smoke test (optional). Needs: pip install playwright && playwright install chromium.
Usage: node serve.mjs & python3 tests/smoke.py http://localhost:8123
Exits non-zero on the first failed check."""
import sys, os
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8123"
SHOTS = os.path.join(os.path.dirname(__file__), "screenshots")
os.makedirs(SHOTS, exist_ok=True)
results = []

def check(name, cond, detail=""):
    results.append((name, bool(cond)))
    print(("PASS  " if cond else "FAIL  ") + name + (f"  [{detail}]" if detail and not cond else ""))

def run(p, label, vp):
    b = p.chromium.launch()
    ctx = b.new_context(viewport=vp, has_touch=True)
    page = ctx.new_page()
    errors = []
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("dialog", lambda d: d.accept())
    page.goto(BASE + "/")
    page.wait_for_selector(".topbar")
    check(f"[{label}] boots, boot message removed", page.query_selector("#boot") is None)
    check(f"[{label}] empty mode badge", "No records" in page.inner_text(".topbar"))
    check(f"[{label}] eye empty caption", "No projects recorded" in page.inner_text(".eye__caption"))
    check(f"[{label}] connections all 'Not connected'", page.inner_text(".status-list").count("Not connected") == 4)
    for v, text in [("projects", "No projects yet"), ("agents", "No agents yet"), ("activity", "No activity logged"), ("tasks", "No tasks yet")]:
        page.click(f'.nav a[href="#/{v}"]')
        page.wait_for_selector(".empty")
        check(f"[{label}] {v} empty state", text in page.inner_text(".empty"))
    page.click('.nav a[href="#/command"]')
    check(f"[{label}] no horizontal overflow", page.evaluate("document.documentElement.scrollWidth <= window.innerWidth"))
    page.screenshot(path=f"{SHOTS}/{label}-empty.png")

    page.click("text=Load sample data")
    page.wait_for_selector(".badge--sample")
    check(f"[{label}] sample mode badge", "Sample data" in page.inner_text(".topbar"))
    check(f"[{label}] eye has 3 segments", len(page.query_selector_all(".eye-seg")) == 3)
    page.click('.nav a[href="#/projects"]')
    page.wait_for_selector(".row")
    check(f"[{label}] 3 sample project rows, each badged", len(page.query_selector_all(".row")) == 3 and len(page.query_selector_all(".row .badge--sample")) == 3)
    page.click(".row >> nth=2 >> summary")
    check(f"[{label}] row expands with blockers", "waiting on a decision" in page.inner_text(".row[open]"))
    page.screenshot(path=f"{SHOTS}/{label}-projects.png")

    page.click('.nav a[href="#/command"]')
    page.fill("#cmd-input", "which projects need attention")
    page.press("#cmd-input", "Enter")
    page.wait_for_selector(".turn")
    check(f"[{label}] command answers from records", "Client Portal [sample]" in page.inner_text(".turn__reply"))
    check(f"[{label}] reply labelled local", "no AI model" in page.inner_text(".turn__src"))
    page.fill("#cmd-input", "tell me a joke"); page.press("#cmd-input", "Enter")
    check(f"[{label}] unknown command does not pretend", "did not recognise" in page.inner_text(".transcript"))
    page.fill("#cmd-input", "add task Smoke test task"); page.press("#cmd-input", "Enter")
    page.click('.nav a[href="#/tasks"]')
    check(f"[{label}] 'add task' command created a task", "Smoke test task" in page.inner_text("main"))
    page.screenshot(path=f"{SHOTS}/{label}-tasks.png")

    # Task toggle
    page.click('.task-check >> nth=0')
    page.wait_for_selector(".is-done")
    check(f"[{label}] task toggle moves to done", len(page.query_selector_all(".is-done")) >= 2)

    # Form validation + add
    page.click('.nav a[href="#/projects"]')
    page.click("text=Add project >> nth=0")
    page.wait_for_selector("dialog[open]")
    page.click("dialog >> text=Save")
    check(f"[{label}] form rejects empty name", "required" in page.inner_text("dialog"))
    page.fill("#f-name", "My real project")
    page.click("dialog >> text=Save")
    page.wait_for_selector("dialog", state="detached")
    check(f"[{label}] project added", "My real project" in page.inner_text("main"))

    # Persistence
    page.reload(); page.wait_for_selector(".topbar")
    check(f"[{label}] mode shows mixed after reload", "Stored and sample" in page.inner_text(".topbar"))
    page.click('.nav a[href="#/projects"]')
    page.wait_for_selector(".row")
    check(f"[{label}] real project survives reload", "My real project" in page.inner_text("main"))

    # Remove sample keeps real
    page.click('.nav a[href="#/command"]')
    page.click("text=Remove sample data")
    page.wait_for_selector(".topbar")
    check(f"[{label}] sample removed, mode 'Stored records'", "Stored records" in page.inner_text(".topbar"))
    page.click('.nav a[href="#/projects"]')
    page.wait_for_selector(".row")
    check(f"[{label}] only real project left", len(page.query_selector_all(".row")) == 1)
    check(f"[{label}] no console errors", not errors, "; ".join(errors))
    b.close()

with sync_playwright() as p:
    run(p, "phone", {"width": 390, "height": 844})
    run(p, "tablet", {"width": 820, "height": 1180})

failed = [n for n, ok in results if not ok]
print(f"\n{len(results) - len(failed)}/{len(results)} browser checks passed")
sys.exit(1 if failed else 0)
