"""Private SMTP transport for aggregate deletion alarms. No credentials in argv."""
import json
import os
import smtplib
import ssl
import sys
from email.message import EmailMessage

try:
    payload = json.load(sys.stdin)
    assert payload['to'] == 'support@lottibaby.de'
    assert os.environ['SMTP_HOST'] == 'smtp.hostinger.com'
    port = int(os.environ.get('SMTP_PORT', '465'))
    assert port in (465, 587)
    message = EmailMessage()
    message['From'] = os.environ['SMTP_USER']
    message['To'] = payload['to']
    message['Subject'] = payload['subject']
    message.set_content(payload['text'])
    context = ssl.create_default_context()
    transport = (smtplib.SMTP_SSL('smtp.hostinger.com', port, timeout=20, context=context)
                 if port == 465 else smtplib.SMTP('smtp.hostinger.com', port, timeout=20))
    with transport as server:
        if port == 587:
            server.starttls(context=context)
        server.login(os.environ['SMTP_USER'], os.environ['SMTP_PASSWORD'])
        server.send_message(message)
except Exception:
    sys.exit(1)
