import csv
import os
import time
from pathlib import Path

import httpx
import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt


REQUEST_COUNT = 500
HEALTH_URL = os.getenv("VIBELY_HEALTH_URL", "http://127.0.0.1:8000/api/health")
TEST_DIR = Path(__file__).resolve().parent
CSV_PATH = TEST_DIR / "load_results.csv"
PLOT_PATH = TEST_DIR / "load_test.png"


def main() -> None:
    results: list[dict[str, object]] = []
    total_started = time.perf_counter()

    with httpx.Client(timeout=10.0) as client:
        for request_number in range(1, REQUEST_COUNT + 1):
            started = time.perf_counter()
            status_code: int | str
            try:
                response = client.get(HEALTH_URL)
                status_code = response.status_code
                successful = response.is_success
            except httpx.HTTPError as error:
                status_code = "error"
                successful = False
                error_message = str(error)
            else:
                error_message = ""

            elapsed_ms = (time.perf_counter() - started) * 1000
            results.append(
                {
                    "request_number": request_number,
                    "status_code": status_code,
                    "successful": successful,
                    "response_time_ms": f"{elapsed_ms:.3f}",
                    "error": error_message,
                }
            )

    total_seconds = time.perf_counter() - total_started
    response_times = [float(result["response_time_ms"]) for result in results]
    successful_count = sum(bool(result["successful"]) for result in results)
    failed_count = REQUEST_COUNT - successful_count
    average_ms = sum(response_times) / REQUEST_COUNT
    requests_per_second = REQUEST_COUNT / total_seconds if total_seconds else 0

    with CSV_PATH.open("w", newline="", encoding="utf-8-sig") as csv_file:
        writer = csv.DictWriter(
            csv_file,
            fieldnames=[
                "request_number",
                "status_code",
                "successful",
                "response_time_ms",
                "error",
            ],
        )
        writer.writeheader()
        writer.writerows(results)

    plt.figure(figsize=(10, 5))
    plt.plot(
        [result["request_number"] for result in results],
        response_times,
        linewidth=0.8,
    )
    plt.xlim(1, REQUEST_COUNT)
    plt.xlabel("Номер запроса")
    plt.ylabel("Время ответа (мс)")
    plt.title("Нагрузочный тест GET /api/health")
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.savefig(PLOT_PATH, dpi=150)
    plt.close()

    print(f"Endpoint: {HEALTH_URL}")
    print(f"Количество запросов: {REQUEST_COUNT}")
    print(f"Успешные: {successful_count}")
    print(f"Ошибочные: {failed_count}")
    print(f"Среднее время ответа: {average_ms:.3f} мс")
    print(f"Минимальное время ответа: {min(response_times):.3f} мс")
    print(f"Максимальное время ответа: {max(response_times):.3f} мс")
    print(f"RPS: {requests_per_second:.2f}")
    print(f"CSV: {CSV_PATH}")
    print(f"График: {PLOT_PATH}")


if __name__ == "__main__":
    main()
