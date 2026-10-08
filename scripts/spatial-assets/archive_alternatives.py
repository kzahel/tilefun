"""Archive exact Python implementations and build a final case execution ledger."""
import argparse
import json
from pathlib import Path
from reference import digest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundle", type=Path, required=True)
    args = parser.parse_args()
    archive = args.bundle / "implementation/by-sha"
    archive.mkdir(parents=True, exist_ok=True)
    files = list(Path(__file__).parent.glob("*.py")) + list((args.bundle / "runs").glob("*/*.py")) + list((args.bundle / "references").glob("*/*.py")) + list((args.bundle / "pipelines").glob("*/implementation/*.py"))
    for file in files:
        output = archive / (digest(file) + ".py")
        if not output.exists():
            output.write_bytes(file.read_bytes())
    cases = []
    for path in sorted((args.bundle / "runs").glob("*/run.json")):
        record = json.loads(path.read_text())
        hashes = record["implementationSha256"]
        hashes = hashes if isinstance(hashes, dict) else {"runner": hashes}
        implementations = {name: archive / (sha + ".py") for name, sha in hashes.items()}
        for implementation in implementations.values():
            if not implementation.exists():
                raise RuntimeError(f"Missing exact implementation: {path.parent.name}: {implementation.name}")
        if record["status"] == "started":
            raise RuntimeError(f"Case unfinished: {path.parent.name}")
        cases.append({"id": path.parent.name, "status": record["status"], "runRecordSha256": digest(path), "implementationFiles": {name: str(file.relative_to(args.bundle)) for name, file in implementations.items()}, "implementationSha256": record["implementationSha256"]})
    ledger = {"status": "completed-with-retained-failures" if any(c["status"] == "failed" for c in cases) else "completed-diagnostics", "cases": cases, "review": "Offline experiment outputs; no human approval or runtime promotion"}
    (args.bundle / "execution.json").write_text(json.dumps(ledger, indent=2) + "\n")
    print(json.dumps({"cases": len(cases), "status": ledger["status"]}))


if __name__ == "__main__":
    main()
