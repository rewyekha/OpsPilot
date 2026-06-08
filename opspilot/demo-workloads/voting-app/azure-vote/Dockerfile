# Bumped to 3.9 so the modern Azure Monitor OpenTelemetry exporter is available
# (it needs Python >= 3.8). The app code itself is unchanged-compatible.
FROM tiangolo/uwsgi-nginx-flask:python3.9
RUN pip install --no-cache-dir redis \
    azure-monitor-opentelemetry-exporter \
    opentelemetry-instrumentation-flask
ADD /azure-vote /app
