import os
from flask import Flask, request, jsonify, send_from_directory
import re

app = Flask(__name__)

# Regex zur einfachen E-Mail-Validierung
EMAIL_REGEX = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'

@app.route('/')
def index():
    """Serviert die Haupt-Landingpage."""
    return send_from_directory('.', 'index.html')

@app.route('/subscribe', methods=['POST'])
def subscribe():
    """Nimmt eine E-Mail-Adresse entgegen und speichert sie."""
    data = request.get_json()
    if not data or 'email' not in data:
        return jsonify({"message": "Keine E-Mail-Adresse angegeben."}), 400

    email = data['email']

    # Einfache Validierung
    if not re.match(EMAIL_REGEX, email):
        return jsonify({"message": "Bitte gib eine gültige E-Mail-Adresse ein."}), 400

    try:
        # 'a' steht für 'append' (anhängen), um die Datei nicht zu überschreiben
        with open('emails.txt', 'a') as f:
            f.write(email + '\n')
        return jsonify({"message": "Super! Wir haben dich eingetragen."}), 200
    except Exception as e:
        print(f"Fehler beim Schreiben in die Datei: {e}")
        return jsonify({"message": "Server-Fehler. Bitte versuche es später erneut."}), 500

if __name__ == '__main__':
    # host='0.0.0.0' macht den Server im lokalen Netzwerk erreichbar
    app.run(host='0.0.0.0', port=8080, debug=True)