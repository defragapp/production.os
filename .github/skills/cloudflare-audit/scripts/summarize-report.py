#!/usr/bin/env python3
import json
from pathlib import Path


def read_json(path: Path):
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text())
    except Exception:
        return {}


def markdown_summary(report_path: Path, out_path: Path):
    report = read_json(report_path)
    findings = report.get("findings", [])
    summary = [
        "# Cloudflare Audit Summary",
        "",
        "## Executive summary",
        "",
        f"- Resources reviewed: {report.get('resources_reviewed', 0)}",
        f"- Findings: {len(findings)}",
        f"- Critical: {sum(1 for f in findings if f.get('severity') == 'critical')}",
        f"- High: {sum(1 for f in findings if f.get('severity') == 'high')}",
        f"- Medium: {sum(1 for f in findings if f.get('severity') == 'medium')}",
        f"- Low: {sum(1 for f in findings if f.get('severity') == 'low')}",
        "",
        "## Findings",
        "",
    ]

    if not findings:
        summary.append("No findings were reported by the audit.")
    else:
        for idx, item in enumerate(findings, 1):
            summary.append(f"### {idx}. {item.get('title', 'Finding')}")
            summary.append("")
            summary.append(f"- Severity: {item.get('severity', 'unknown')}")
            summary.append(f"- Evidence: {item.get('evidence', 'not provided')}")
            summary.append(f"- Recommendation: {item.get('recommendation', 'review manually')}")
            summary.append("")

    out_path.write_text("\n".join(summary) + "\n")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Summarize a JSON Cloudflare audit report.")
    parser.add_argument("report", type=Path, help="Path to a JSON report file")
    parser.add_argument("--out", type=Path, default=Path("cloudflare-audit-summary.md"), help="Output Markdown path")
    args = parser.parse_args()
    markdown_summary(args.report, args.out)
    print(f"Summary written to {args.out}")
