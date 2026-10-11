#!/usr/bin/env python3
import json
from pathlib import Path


def read_json(path: Path):
    report = json.loads(path.read_text())
    if not isinstance(report, dict):
        raise ValueError("Audit report must contain a JSON object.")
    findings = report.get("findings", [])
    if not isinstance(findings, list) or any(not isinstance(item, dict) for item in findings):
        raise ValueError("Audit report findings must be an array of objects.")
    if any(
        "confidence" in item
        and (not isinstance(item["confidence"], (int, float)) or isinstance(item["confidence"], bool))
        for item in findings
    ):
        raise ValueError("Finding confidence values must be numbers.")
    errors = report.get("collectionErrors", [])
    if not isinstance(errors, list) or any(not isinstance(item, dict) for item in errors):
        raise ValueError("Audit report collectionErrors must be an array of objects.")
    if "target" in report and not isinstance(report["target"], dict):
        raise ValueError("Audit report target must be an object.")
    return report


def markdown_summary(report_path: Path, out_path: Path):
    report = read_json(report_path)
    findings = report.get("findings", [])
    resources_reviewed = report.get("resourcesReviewed", report.get("resources_reviewed", 0))
    target = report.get("target", {})
    summary = [
        "# Cloudflare Audit Summary",
        "",
        "## Executive summary",
        "",
        f"- Status: {report.get('status', 'unspecified')}",
        f"- Resources reviewed: {resources_reviewed}",
        f"- Findings: {len(findings)}",
        f"- Critical: {sum(1 for f in findings if f.get('severity') == 'critical')}",
        f"- High: {sum(1 for f in findings if f.get('severity') == 'high')}",
        f"- Medium: {sum(1 for f in findings if f.get('severity') == 'medium')}",
        f"- Low: {sum(1 for f in findings if f.get('severity') == 'low')}",
        "",
    ]

    if target:
        summary.extend(
            [
                f"- Target Worker: {target.get('worker', 'unknown')}",
                f"- Target account: {target.get('accountId', 'unknown')}",
                "",
            ]
        )
    if report.get("collectionErrors"):
        summary.extend(["## Collection errors", ""])
        for error in report["collectionErrors"]:
            summary.append(f"- {error.get('resource', 'unknown')}: {error.get('message', 'not provided')}")
        summary.append("")
    summary.extend(["## Findings", ""])

    if not findings:
        summary.append("No findings were reported by the audit.")
    else:
        for idx, item in enumerate(findings, 1):
            summary.append(f"### {idx}. {item.get('title', 'Finding')}")
            summary.append("")
            summary.append(f"- Severity: {item.get('severity', 'unknown')}")
            summary.append(f"- Resource: {item.get('resource', 'not provided')}")
            summary.append(f"- Evidence: {item.get('evidence', 'not provided')}")
            summary.append(f"- Recommendation: {item.get('recommendation', 'review manually')}")
            if item.get("confidence") is not None:
                summary.append(f"- Confidence: {round(item['confidence'] * 100)}%")
            summary.append("")

    out_path.write_text("\n".join(summary) + "\n")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Summarize a JSON Cloudflare audit report.")
    parser.add_argument("report", type=Path, help="Path to a JSON report file")
    parser.add_argument("--out", type=Path, default=Path("cloudflare-audit-summary.md"), help="Output Markdown path")
    args = parser.parse_args()
    try:
        markdown_summary(args.report, args.out)
    except (OSError, json.JSONDecodeError, ValueError) as error:
        parser.error(str(error))
    print(f"Summary written to {args.out}")
