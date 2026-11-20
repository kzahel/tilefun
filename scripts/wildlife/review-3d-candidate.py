"""Submit or inspect a Tilefun wildlife model review using its local YA launch grant."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
from urllib.parse import quote, urlencode

from wildlife_3d_review import completed_feedback

ROOT = Path(__file__).resolve().parents[2]
SERVER = "/v0/servers/self"
MODEL = "claude-opus-5-5"
POOL = "Work-claude"
OPERATIONS = {"createSession", "receipt", "session", "conversation", "selection"}


def api(path, *, body=None, key=None):
    credentials = [os.environ.get(k) for k in
                   ("AGENT_YA_V0_SOCKET", "AGENT_YA_V0_AUTHORIZATION", "AGENT_YA_V0_URL")]
    if not all(credentials):
        raise SystemExit("The owning session has no Yep Anywhere v0 connection.")
    socket, authorization, url = credentials
    command = [
        "curl", "--silent", "--show-error", "--fail-with-body", "--max-time", "20",
        "--unix-socket", socket, "-H", "Authorization: " + authorization,
    ]
    payload = None
    if body is not None:
        command += ["-H", "Content-Type: application/json",
                    "-H", "Idempotency-Key: " + key, "--data-binary", "@-"]
        payload = json.dumps(body, ensure_ascii=False, sort_keys=True)
    result = subprocess.run(command + [url.rstrip("/") + path], input=payload,
                            capture_output=True, text=True, check=False)
    if result.returncode:
        message = result.stderr.strip()
        try:
            failure = json.loads(result.stdout).get("error", {})
            message = failure.get("message", message)
        except json.JSONDecodeError:
            pass
        raise RuntimeError(message)
    return json.loads(result.stdout)


def project_id():
    query = {"limit": 100}
    while True:
        page = api(SERVER + "/projects?" + urlencode(query))
        for project in page["items"]:
            if Path(project["path"]).resolve() == ROOT:
                return project["id"]
        cursor = page.get("nextCursor")
        if cursor is None:
            raise SystemExit("Tilefun is unavailable in the local Yep Anywhere project catalog.")
        query["cursor"] = cursor


def launch_settings():
    identity = api("/v0/me")
    if not identity.get("session", {}).get("management"):
        raise SystemExit("This launch has no Yep Anywhere session-command grant.")
    for endpoint in ("access", "capabilities"):
        if not OPERATIONS <= set(api(SERVER + "/" + endpoint)["operations"]):
            raise SystemExit(f"Required Yep Anywhere operations are unavailable in {endpoint}.")
    providers = api(SERVER + "/providers")
    if "claude" not in {item["id"] for item in providers["items"]}:
        raise SystemExit("The Claude reviewer harness is unavailable.")
    selection = api(SERVER + "/selection?provider=claude")
    pool = next((p for p in selection["pools"] if p["name"] == POOL), None)
    if not pool or not selection["available"]:
        raise SystemExit("The selected Work-claude route is unavailable.")
    eligible = [
        a for a in selection["accounts"]
        if a["id"] in pool["accountIds"] and a.get("enabled") and
        any(m["id"] == MODEL and
            any(e["reasoningEffort"] == "medium" for e in m["supportedReasoningEfforts"])
            for m in a["models"])
    ]
    if not eligible:
        raise SystemExit("No eligible Work-claude account advertises Opus 5.5 medium.")
    return {"projectId": project_id(), "provider": "claude", "model": MODEL,
            "thinking": "on:medium", "permissionMode": "bypassPermissions",
            "routerPoolId": pool["id"], "routerPolicy": pool["policy"]}


def file_fingerprint(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(path, value, *, exclusive=False):
    text = json.dumps(value, indent=2, ensure_ascii=False) + "\n"
    if exclusive:
        with path.open("x", encoding="utf8") as handle:
            handle.write(text)
        return
    pending = path.with_suffix(".tmp")
    pending.write_text(text, encoding="utf8")
    pending.replace(path)


def candidate_request(directory):
    packet = json.loads((directory / "packet.json").read_text())
    version = packet["version"]
    if version not in (1, 2) or not re.fullmatch(r"[a-z0-9-]+", packet["runtimeType"]):
        raise ValueError("Candidate requires a stable runtime type and version 1 or 2.")
    files = {
        "live sprite source": (ROOT / packet["sprite"]).resolve(),
        **{label: (directory / name).resolve() for label, name in packet["evidence"].items()},
    }
    benchmark = ROOT / "data/wildlife-3d-campaign/wildlife-cat-provisional-v1/v1/cat-appearance.png"
    if packet["runtimeType"] != "wildlife-cat-provisional-v1" and benchmark.is_file():
        files["owner-liked cat finish benchmark"] = benchmark
    if version == 2:
        for name in ("appearance.png", "cat-appearance.png"):
            first = directory.parent / "v1" / name
            if first.is_file():
                files["first pass for comparison"] = first
                break
    if any(not file.is_relative_to(ROOT) for file in files.values()):
        raise ValueError("Evidence must be within the Tilefun checkout.")
    fingerprints = {label: file_fingerprint(file) for label, file in files.items()}
    prompt = "\n".join([
        f"Tilefun tactical 255 independent art review: {packet['name']}, "
        f"runtime type {packet['runtimeType']}, candidate {version}.",
        "Review only. You may read the listed local files and inspect the images. "
        "Do not edit assets or code, post feedback elsewhere, or perform session actions.",
        "Inspect the native sprite/model views, enlarged stills and timestamped motion frames. "
        "Video is optional if your tools cannot view it directly. Compare exact gameplay sprite "
        "to candidate in the same top-down projection, and look at the model close-up. "
        "Use the owner-liked tuxedo cat draft as the level of finish.",
        "Judge recognizability and charm, silhouette, palette and markings, game-scale fit, "
        "animation clarity and visible contact. Return exactly one leading verdict line "
        "VERDICT: meets-bar, VERDICT: revise, or VERDICT: insufficient-evidence. Then give "
        "up to three concrete view or pose observations and the highest-impact fix, if any.",
        "The revision cap is two candidates per animal. The primary agent owns changes.",
        packet.get("reviewContext", ""),
        *[f"{label}: {path}" for label, path in files.items()],
    ])
    fingerprint = hashlib.sha256(json.dumps(fingerprints, sort_keys=True).encode()).hexdigest()
    key = f"tilefun-255-{packet['runtimeType']}-v{version}-{fingerprint[:12]}"
    return key, fingerprints, prompt


def submit(directory):
    state_path = directory / "review.json"
    if state_path.exists():
        raise SystemExit("Review already recorded. Use status to inspect its receipt.")
    key, fingerprints, prompt = candidate_request(directory)
    state = {"idempotencyKey": key, "evidenceSha256": fingerprints,
             "request": {**launch_settings(), "prompt": prompt}}
    write_json(state_path, state, exclusive=True)
    dispatch(state_path, state)


def dispatch(state_path, state):
    try:
        state["admission"] = api(SERVER + "/sessions", body=state["request"],
                                 key=state["idempotencyKey"])
    except RuntimeError as error:
        state["dispatchError"] = str(error)
        write_json(state_path, state)
        raise
    write_json(state_path, state)
    print(json.dumps({k: state["admission"].get(k) for k in ("id", "sessionId", "state")}))


def retry_admission(directory, *, reconcile=False):
    """Refresh selection after a confirmed rejection or reconciled missing launch."""
    state_path = directory / "review.json"
    original = json.loads(state_path.read_text())
    receipt = api(SERVER + "/receipts/" + quote(original["admission"]["id"], safe=""))
    if reconcile:
        if receipt.get("state") != "uncertain" or "reconciledAdmission" in original:
            raise SystemExit("Reconciliation requires an uncertain launch and is allowed once.")
        if receipt.get("sessionId"):
            try:
                api(SERVER + "/sessions/" + quote(receipt["sessionId"], safe=""))
            except RuntimeError as error:
                if str(error) != "Session not found":
                    raise
            else:
                raise SystemExit("The reserved reviewer session exists. Inspect its conversation.")
        title = original["request"]["prompt"].splitlines()[0]
        query = {"projectId": project_id(), "limit": 100}
        while True:
            page = api(SERVER + "/sessions?" + urlencode(query))
            if any(item.get("title", "") == title or item.get("id") == receipt.get("sessionId")
                   for item in page["items"]):
                raise SystemExit("The project catalog contains a matching reviewer session.")
            cursor = page.get("nextCursor")
            if not cursor:
                break
            query["cursor"] = cursor
        if api(SERVER + "/receipts/" + quote(receipt["id"], safe="")).get("state") != "uncertain":
            raise SystemExit("The receipt changed during reconciliation. Inspect its state again.")
    elif (receipt.get("state") != "failed" or
          receipt.get("failure", {}).get("code") != "admission_rejected" or
          receipt.get("delivery") == "consumed" or "priorAdmission" in original):
        raise SystemExit("Retry requires a confirmed pre-launch rejection and is allowed once.")
    current_files = candidate_request(directory)[1]
    if any(current_files.get(label) != fingerprint
           for label, fingerprint in original["evidenceSha256"].items()):
        raise SystemExit("Candidate evidence changed after review dispatch.")
    state = {"idempotencyKey": original["idempotencyKey"] + ("-reconciled" if reconcile else "-retry1"),
             "evidenceSha256": original["evidenceSha256"],
             "request": {**launch_settings(), "prompt": original["request"]["prompt"]},
             **{key: original[key] for key in ("priorAdmission", "reconciledAdmission")
                if key in original},
             ("reconciledAdmission" if reconcile else "priorAdmission"): receipt}
    write_json(state_path, state)
    dispatch(state_path, state)


def status(directory, *, silent=False):
    path = directory / "review.json"
    state = json.loads(path.read_text())
    if "admission" not in state:
        raise SystemExit("Submission is uncertain. Reconcile the recorded key and payload with YA before retrying.")
    receipt = api(SERVER + "/receipts/" + quote(state["admission"]["id"], safe=""))
    output = {"receipt": receipt}
    if receipt.get("state") == "accepted" and receipt.get("sessionId"):
        endpoint = SERVER + "/sessions/" + quote(receipt["sessionId"], safe="")
        output["session"] = api(endpoint)
        output["conversation"] = api(endpoint + "/conversation?maxMessages=12")
        settings = output["session"].get("settings", {})
        route = output["session"].get("routing", {})
        output["verifiedRoute"] = (
            settings.get("model") == MODEL and settings.get("effort") == "medium" and
            settings.get("permissionMode") == "bypassPermissions" and route.get("poolName") == POOL
        )
        verdict, _ = completed_feedback(output)
        if verdict:
            output["verdict"] = verdict
    write_json(directory / "review-status.json", output)
    summary = {"state": receipt.get("state"), "delivery": receipt.get("delivery"),
               "verifiedRoute": output.get("verifiedRoute"), "verdict": output.get("verdict")}
    if not silent:
        print(json.dumps(summary))
    return summary


def refresh_all(root):
    def refresh(path):
        directory = path.parent
        result_path = directory / "review-status.json"
        if result_path.exists() and json.loads(result_path.read_text()).get("verdict"):
            return None
        label = directory.relative_to(root).as_posix()
        try:
            return label, status(directory, silent=True)
        except (RuntimeError, SystemExit) as error:
            return label, {"error": str(error)}

    with ThreadPoolExecutor(max_workers=3) as workers:
        for result in workers.map(refresh, sorted(root.glob("*/v[12]/review.json"))):
            if result:
                print(result[0], json.dumps(result[1]))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("submit", "status", "refresh", "retry-rejected",
                                            "retry-reconciled"))
    parser.add_argument("candidate", type=Path)
    args = parser.parse_args()
    directory = args.candidate.resolve()
    if args.command in ("retry-rejected", "retry-reconciled"):
        retry_admission(directory, reconcile=args.command == "retry-reconciled")
    else:
        {"submit": submit, "status": status, "refresh": refresh_all}[args.command](directory)


if __name__ == "__main__":
    main()
