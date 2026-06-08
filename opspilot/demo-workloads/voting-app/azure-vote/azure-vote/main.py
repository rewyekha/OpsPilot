from flask import Flask, request, render_template
import os
import random
import redis
import socket
import sys

app = Flask(__name__)

# ── OpenTelemetry → Azure Monitor (so OpsPilot DISCOVERS + MONITORS this app) ──
# Records each HTTP request into Application Insights AppRequests with cloud role
# name = voting-app, exactly like album-api. Uses BatchSpanProcessor (export runs
# on a BACKGROUND thread, so requests are NOT blocked on the telemetry POST), and
# initialises it POST-FORK so that background thread lives inside each uwsgi worker
# (a thread created in the pre-fork master would die on fork → no telemetry).
# No-op when APPLICATIONINSIGHTS_CONNECTION_STRING is unset.
def _init_opspilot_telemetry():
    try:
        _ai_conn = os.environ.get('APPLICATIONINSIGHTS_CONNECTION_STRING')
        if not _ai_conn:
            return
        from opentelemetry import trace
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
        from opentelemetry.sdk.resources import Resource
        from opentelemetry.instrumentation.flask import FlaskInstrumentor
        from azure.monitor.opentelemetry.exporter import AzureMonitorTraceExporter

        _role = os.environ.get('OPSPILOT_SERVICE_NAME', 'voting-app')
        _provider = TracerProvider(resource=Resource.create({'service.name': _role}))
        _provider.add_span_processor(
            BatchSpanProcessor(AzureMonitorTraceExporter(connection_string=_ai_conn))
        )
        trace.set_tracer_provider(_provider)
        FlaskInstrumentor().instrument_app(app)
        print('OpsPilot: App Insights instrumentation enabled (role=%s)' % _role, file=sys.stderr)
    except Exception as _otel_exc:  # never let telemetry wiring crash the app
        print('OpsPilot: App Insights instrumentation failed: %s' % _otel_exc, file=sys.stderr)


try:
    from uwsgidecorators import postfork  # available when running under uwsgi
    postfork(_init_opspilot_telemetry)
except ImportError:
    _init_opspilot_telemetry()  # plain process (e.g. flask dev server)

# Load configurations from environment or config file
app.config.from_pyfile('config_file.cfg')

if ("VOTE1VALUE" in os.environ and os.environ['VOTE1VALUE']):
    button1 = os.environ['VOTE1VALUE']
else:
    button1 = app.config['VOTE1VALUE']

if ("VOTE2VALUE" in os.environ and os.environ['VOTE2VALUE']):
    button2 = os.environ['VOTE2VALUE']
else:
    button2 = app.config['VOTE2VALUE']

if ("TITLE" in os.environ and os.environ['TITLE']):
    title = os.environ['TITLE']
else:
    title = app.config['TITLE']

# Redis configurations
redis_server = os.environ['REDIS']

# Redis Connection
try:
    if "REDIS_PWD" in os.environ:
        r = redis.StrictRedis(host=redis_server,
                        port=6379,
                        password=os.environ['REDIS_PWD'])
    else:
        r = redis.Redis(redis_server)
    r.ping()
except redis.ConnectionError:
    exit('Failed to connect to Redis, terminating.')

# Change title to host name to demo NLB
if app.config['SHOWHOST'] == "true":
    title = socket.gethostname()

# Init Redis
if not r.get(button1): r.set(button1,0)
if not r.get(button2): r.set(button2,0)

@app.route('/', methods=['GET', 'POST'])
def index():

    if request.method == 'GET':

        # Get current values
        vote1 = r.get(button1).decode('utf-8')
        vote2 = r.get(button2).decode('utf-8')            

        # Return index with values
        return render_template("index.html", value1=int(vote1), value2=int(vote2), button1=button1, button2=button2, title=title)

    elif request.method == 'POST':

        if request.form['vote'] == 'reset':
            
            # Empty table and return results
            r.set(button1,0)
            r.set(button2,0)
            vote1 = r.get(button1).decode('utf-8')
            vote2 = r.get(button2).decode('utf-8')
            return render_template("index.html", value1=int(vote1), value2=int(vote2), button1=button1, button2=button2, title=title)
        
        else:

            # Insert vote result into DB
            vote = request.form['vote']
            r.incr(vote,1)
            
            # Get current values
            vote1 = r.get(button1).decode('utf-8')
            vote2 = r.get(button2).decode('utf-8')  
                
            # Return results
            return render_template("index.html", value1=int(vote1), value2=int(vote2), button1=button1, button2=button2, title=title)

if __name__ == "__main__":
    app.run()
