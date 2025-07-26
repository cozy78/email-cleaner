# Email Cleaner Backend API - Flask Server für Gmail Actions
# pip install flask flask-cors

import os
import pickle
import base64
import time
import requests
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

app = Flask(__name__)
CORS(app)  # Ermöglicht Frontend-Backend Kommunikation

class GmailAPI:
    def __init__(self):
        self.SCOPES = [
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/gmail.modify',
            'https://www.googleapis.com/auth/gmail.labels'
        ]
        self.service = None
        self.authenticate()
    
    def authenticate(self):
        """Gmail API Authentifizierung"""
        creds = None
        
        if os.path.exists('gmail_token.pickle'):
            with open('gmail_token.pickle', 'rb') as token:
                creds = pickle.load(token)
        
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                creds.refresh(Request())
            else:
                flow = InstalledAppFlow.from_client_secrets_file(
                    'credentials.json', self.SCOPES)
                creds = flow.run_local_server(port=0)
            
            with open('gmail_token.pickle', 'wb') as token:
                pickle.dump(creds, token)
        
        self.service = build('gmail', 'v1', credentials=creds)
        print("✅ Gmail API connected")
        return True
    
    def get_email_details(self, email_id):
        """Email-Details abrufen"""
        try:
            message = self.service.users().messages().get(
                userId='me', 
                id=email_id, 
                format='full'
            ).execute()
            
            # Headers extrahieren
            headers = {}
            for header in message['payload'].get('headers', []):
                headers[header['name'].lower()] = header['value']
            
            return {
                'id': email_id,
                'subject': headers.get('subject', 'Kein Betreff'),
                'from': headers.get('from', 'Unbekannt'),
                'headers': headers,
                'labels': message.get('labelIds', [])
            }
        except HttpError as error:
            print(f"❌ Error getting email details: {error}")
            return None
    
    def delete_email(self, email_id):
        """Email löschen (in Trash verschieben)"""
        try:
            self.service.users().messages().trash(userId='me', id=email_id).execute()
            print(f"🗑️ Email {email_id} deleted")
            return True
        except HttpError as error:
            print(f"❌ Error deleting email: {error}")
            return False
    
    def unsubscribe_from_newsletter(self, email_id):
        """Von Newsletter abmelden"""
        try:
            # Email-Details abrufen für Unsubscribe-Link
            email_details = self.get_email_details(email_id)
            if not email_details:
                return {'success': False, 'error': 'Email nicht gefunden'}
            
            # List-Unsubscribe Header prüfen
            list_unsubscribe = email_details['headers'].get('list-unsubscribe', '')
            unsubscribe_url = None
            
            if list_unsubscribe:
                # URL aus Header extrahieren
                import re
                url_match = re.search(r'<(https?://[^>]+)>', list_unsubscribe)
                if url_match:
                    unsubscribe_url = url_match.group(1)
            
            if unsubscribe_url:
                # HTTP Request an Unsubscribe-URL
                try:
                    response = requests.get(unsubscribe_url, timeout=10, allow_redirects=True)
                    if response.status_code == 200:
                        # Email auch löschen nach erfolgreichem Unsubscribe
                        self.delete_email(email_id)
                        return {
                            'success': True, 
                            'message': 'Erfolgreich abgemeldet',
                            'url': unsubscribe_url
                        }
                    else:
                        return {
                            'success': False, 
                            'error': f'Unsubscribe fehlgeschlagen (Status {response.status_code})',
                            'url': unsubscribe_url
                        }
                except Exception as e:
                    return {
                        'success': False, 
                        'error': f'HTTP-Fehler: {str(e)}',
                        'url': unsubscribe_url
                    }
            else:
                # Kein Unsubscribe-Link gefunden, nur löschen
                deleted = self.delete_email(email_id)
                return {
                    'success': deleted,
                    'message': 'Kein Unsubscribe-Link gefunden, Email gelöscht' if deleted else 'Fehler beim Löschen',
                    'url': None
                }
                
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    def create_cleanup_label(self, label_name="🤖 Email-Cleaner"):
        """Label für verarbeitete Emails erstellen"""
        try:
            label_object = {
                'name': label_name,
                'messageListVisibility': 'show',
                'labelListVisibility': 'labelShow'
            }
            
            label = self.service.users().labels().create(
                userId='me', 
                body=label_object
            ).execute()
            
            return label['id']
            
        except HttpError as error:
            if 'Label name exists' in str(error):
                # Label existiert bereits
                labels = self.service.users().labels().list(userId='me').execute()
                for label in labels['labels']:
                    if label['name'] == label_name:
                        return label['id']
            return None
    
    def add_label_to_email(self, email_id, label_id):
        """Label zu Email hinzufügen"""
        try:
            self.service.users().messages().modify(
                userId='me',
                id=email_id,
                body={'addLabelIds': [label_id]}
            ).execute()
            return True
        except HttpError as error:
            print(f"❌ Error adding label: {error}")
            return False

# Gmail API Instanz
gmail = GmailAPI()

# API Endpoints

@app.route('/api/health', methods=['GET'])
def health_check():
    """API Gesundheitscheck"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'gmail_connected': gmail.service is not None
    })

@app.route('/api/email/<email_id>/delete', methods=['POST'])
def delete_email(email_id):
    """Einzelne Email löschen"""
    try:
        success = gmail.delete_email(email_id)
        return jsonify({
            'success': success,
            'email_id': email_id,
            'message': 'Email gelöscht' if success else 'Fehler beim Löschen'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/email/<email_id>/unsubscribe', methods=['POST'])
def unsubscribe_email(email_id):
    """Von Newsletter abmelden"""
    try:
        result = gmail.unsubscribe_from_newsletter(email_id)
        return jsonify(result)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/bulk-delete', methods=['POST'])
def bulk_delete():
    """Mehrere Emails auf einmal löschen"""
    try:
        data = request.get_json()
        email_ids = data.get('email_ids', [])
        
        if not email_ids:
            return jsonify({'success': False, 'error': 'Keine Email-IDs angegeben'}), 400
        
        results = []
        success_count = 0
        
        for email_id in email_ids:
            success = gmail.delete_email(email_id)
            results.append({
                'email_id': email_id,
                'success': success
            })
            if success:
                success_count += 1
            
            # Rate limiting
            time.sleep(0.1)
        
        return jsonify({
            'success': True,
            'total_processed': len(email_ids),
            'successful_deletions': success_count,
            'results': results
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/bulk-unsubscribe', methods=['POST'])
def bulk_unsubscribe():
    """Von mehreren Newslettern abmelden"""
    try:
        data = request.get_json()
        email_ids = data.get('email_ids', [])
        
        if not email_ids:
            return jsonify({'success': False, 'error': 'Keine Email-IDs angegeben'}), 400
        
        results = []
        success_count = 0
        
        # Cleanup-Label erstellen
        label_id = gmail.create_cleanup_label()
        
        for email_id in email_ids:
            result = gmail.unsubscribe_from_newsletter(email_id)
            
            # Label hinzufügen falls erfolgreich
            if result['success'] and label_id:
                gmail.add_label_to_email(email_id, label_id)
            
            results.append({
                'email_id': email_id,
                **result
            })
            
            if result['success']:
                success_count += 1
            
            # Rate limiting - wichtig für Gmail API
            time.sleep(1)
        
        return jsonify({
            'success': True,
            'total_processed': len(email_ids),
            'successful_unsubscribes': success_count,
            'results': results
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/email/<email_id>/details', methods=['GET'])
def get_email_details(email_id):
    """Email-Details abrufen"""
    try:
        details = gmail.get_email_details(email_id)
        if details:
            return jsonify(details)
        else:
            return jsonify({'error': 'Email nicht gefunden'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/newsletter-analysis', methods=['POST'])
def analyze_newsletters():
    """Newsletter-Analyse mit Action-Empfehlungen"""
    try:
        data = request.get_json()
        newsletters = data.get('newsletters', [])
        
        analysis = {
            'total_newsletters': len(newsletters),
            'total_size_mb': sum(n.get('size_mb', 0) for n in newsletters),
            'recommendations': [],
            'actionable_emails': []
        }
        
        # Emails mit Unsubscribe-Links finden
        for newsletter in newsletters:
            if newsletter.get('unsubscribe_link'):
                analysis['actionable_emails'].append({
                    'id': newsletter.get('id'),
                    'subject': newsletter.get('subject'),
                    'from': newsletter.get('from'),
                    'size_mb': newsletter.get('size_mb', 0),
                    'action': 'unsubscribe_available'
                })
            else:
                analysis['actionable_emails'].append({
                    'id': newsletter.get('id'),
                    'subject': newsletter.get('subject'),
                    'from': newsletter.get('from'),
                    'size_mb': newsletter.get('size_mb', 0),
                    'action': 'delete_only'
                })
        
        # Empfehlungen generieren
        if len(newsletters) > 10:
            analysis['recommendations'].append({
                'type': 'bulk_cleanup',
                'priority': 'high',
                'message': f'{len(newsletters)} Newsletter gefunden - Bulk-Cleanup empfohlen'
            })
        
        return jsonify(analysis)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print("🚀 Email Cleaner Backend API starting...")
    print("📧 Gmail API connection:", "✅" if gmail.service else "❌")
    print("🌐 Server running on http://localhost:5000")
    print("\nAvailable endpoints:")
    print("  GET  /api/health")
    print("  POST /api/email/<id>/delete")
    print("  POST /api/email/<id>/unsubscribe")
    print("  POST /api/bulk-delete")
    print("  POST /api/bulk-unsubscribe")
    print("  GET  /api/email/<id>/details")
    print("  POST /api/newsletter-analysis")
    
    app.run(debug=True, port=5000)