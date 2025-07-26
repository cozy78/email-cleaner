# Smart Email Cleaner - Gmail Automatisierung
# Benötigte Pakete: pip install google-api-python-client google-auth-httplib2 google-auth-oauthlib beautifulsoup4 requests

import os
import pickle
import base64
import re
import time
from datetime import datetime, timedelta
from typing import List, Dict, Tuple
import json

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from bs4 import BeautifulSoup
import requests

class EmailCleaner:
    def __init__(self):
        # Gmail API Scopes - was wir alles dürfen
        self.SCOPES = [
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/gmail.modify',
            'https://www.googleapis.com/auth/gmail.labels'
        ]
        
        self.service = None
        self.stats = {
            'emails_processed': 0,
            'newsletters_found': 0,
            'unsubscribed': 0,
            'deleted': 0,
            'space_freed_mb': 0
        }
        
        # Newsletter-Erkennungs-Patterns
        self.newsletter_patterns = [
            r'newsletter',
            r'unsubscribe',
            r'list-unsubscribe',
            r'marketing',
            r'promotional',
            r'noreply',
            r'no-reply',
            r'digest',
            r'weekly',
            r'daily',
            r'update'
        ]
        
    def authenticate_gmail(self):
        """Gmail API Authentifizierung"""
        creds = None
        
        # Token aus vorherigem Login laden
        if os.path.exists('gmail_token.pickle'):
            with open('gmail_token.pickle', 'rb') as token:
                creds = pickle.load(token)
        
        # Wenn keine gültigen Credentials vorhanden
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                creds.refresh(Request())
            else:
                # Neue Authentifizierung (braucht credentials.json von Google Cloud Console)
                flow = InstalledAppFlow.from_client_secrets_file(
                    'credentials.json', self.SCOPES)
                creds = flow.run_local_server(port=0)
            
            # Token für nächstes Mal speichern
            with open('gmail_token.pickle', 'wb') as token:
                pickle.dump(creds, token)
        
        self.service = build('gmail', 'v1', credentials=creds)
        print("✅ Gmail API erfolgreich verbunden")
        return True
    
    def get_emails(self, query: str = "", max_results: int = 100) -> List[Dict]:
        """Emails mit bestimmter Query abrufen"""
        try:
            # Suche nach Emails
            results = self.service.users().messages().list(
                userId='me', 
                q=query, 
                maxResults=max_results
            ).execute()
            
            messages = results.get('messages', [])
            print(f"📧 {len(messages)} Emails gefunden mit Query: '{query}'")
            
            return messages
            
        except HttpError as error:
            print(f"❌ Fehler beim Abrufen der Emails: {error}")
            return []
    
    def get_email_details(self, msg_id: str) -> Dict:
        """Detaillierte Email-Informationen abrufen"""
        try:
            message = self.service.users().messages().get(
                userId='me', 
                id=msg_id, 
                format='full'
            ).execute()
            
            # Headers extrahieren
            headers = {}
            for header in message['payload'].get('headers', []):
                headers[header['name'].lower()] = header['value']
            
            # Email Body extrahieren
            body = self.extract_email_body(message['payload'])
            
            # Größe berechnen
            size_mb = int(message.get('sizeEstimate', 0)) / (1024 * 1024)
            
            return {
                'id': msg_id,
                'subject': headers.get('subject', 'Kein Betreff'),
                'from': headers.get('from', 'Unbekannt'),
                'to': headers.get('to', ''),
                'date': headers.get('date', ''),
                'body': body,
                'size_mb': size_mb,
                'headers': headers,
                'labels': message.get('labelIds', [])
            }
            
        except HttpError as error:
            print(f"❌ Fehler beim Abrufen der Email-Details: {error}")
            return {}
    
    def extract_email_body(self, payload) -> str:
        """Email-Body aus Payload extrahieren"""
        body = ""
        
        if 'parts' in payload:
            for part in payload['parts']:
                if part['mimeType'] == 'text/plain':
                    data = part['body']['data']
                    body = base64.urlsafe_b64decode(data).decode('utf-8')
                    break
                elif part['mimeType'] == 'text/html':
                    data = part['body']['data']
                    html_body = base64.urlsafe_b64decode(data).decode('utf-8')
                    # HTML zu Text konvertieren
                    soup = BeautifulSoup(html_body, 'html.parser')
                    body = soup.get_text()
        else:
            if payload['body'].get('data'):
                body = base64.urlsafe_b64decode(payload['body']['data']).decode('utf-8')
        
        return body
    
    def is_newsletter(self, email_details: Dict) -> bool:
        """Prüfen ob Email ein Newsletter ist"""
        # Verschiedene Kriterien prüfen
        checks = []
        
        # 1. Unsubscribe-Header prüfen
        list_unsubscribe = email_details['headers'].get('list-unsubscribe', '')
        if list_unsubscribe:
            checks.append(('list-unsubscribe-header', True))
        
        # 2. From-Adresse prüfen
        from_email = email_details['from'].lower()
        for pattern in self.newsletter_patterns:
            if pattern in from_email:
                checks.append((f'from-pattern-{pattern}', True))
                break
        
        # 3. Subject prüfen
        subject = email_details['subject'].lower()
        newsletter_subjects = ['newsletter', 'weekly', 'daily', 'digest', 'update']
        for pattern in newsletter_subjects:
            if pattern in subject:
                checks.append((f'subject-pattern-{pattern}', True))
                break
        
        # 4. Body nach Unsubscribe-Links durchsuchen
        body = email_details['body'].lower()
        unsubscribe_indicators = ['unsubscribe', 'abmelden', 'newsletter abbestellen']
        for indicator in unsubscribe_indicators:
            if indicator in body:
                checks.append((f'body-unsubscribe-{indicator}', True))
                break
        
        # Newsletter wenn mindestens 2 Kriterien erfüllt
        is_newsletter = len(checks) >= 2
        
        if is_newsletter:
            print(f"📰 Newsletter erkannt: {email_details['subject'][:50]}...")
            print(f"   Kriterien: {[check[0] for check in checks]}")
        
        return is_newsletter
    
    def find_unsubscribe_link(self, email_details: Dict) -> str:
        """Unsubscribe-Link in Email finden"""
        # 1. List-Unsubscribe Header prüfen
        list_unsubscribe = email_details['headers'].get('list-unsubscribe', '')
        if list_unsubscribe:
            # URL aus Header extrahieren
            url_match = re.search(r'<(https?://[^>]+)>', list_unsubscribe)
            if url_match:
                return url_match.group(1)
        
        # 2. HTML Body nach Unsubscribe-Links durchsuchen
        body = email_details['body']
        
        # Regex für Unsubscribe-URLs
        unsubscribe_patterns = [
            r'href=["\']([^"\']*unsubscribe[^"\']*)["\']',
            r'href=["\']([^"\']*abmelden[^"\']*)["\']',
            r'https?://[^\s]*unsubscribe[^\s]*',
        ]
        
        for pattern in unsubscribe_patterns:
            matches = re.findall(pattern, body, re.IGNORECASE)
            if matches:
                return matches[0]
        
        return ""
    
    def unsubscribe_safely(self, unsubscribe_url: str) -> bool:
        """Sicher von Newsletter abmelden"""
        if not unsubscribe_url:
            return False
        
        try:
            # Erst mal nur GET Request zum Testen
            response = requests.get(unsubscribe_url, timeout=10, allow_redirects=True)
            
            if response.status_code == 200:
                print(f"✅ Unsubscribe erfolgreich: {unsubscribe_url}")
                return True
            else:
                print(f"⚠️  Unsubscribe fehlgeschlagen (Status {response.status_code}): {unsubscribe_url}")
                return False
                
        except Exception as e:
            print(f"❌ Fehler beim Unsubscribe: {e}")
            return False
    
    def delete_email(self, email_id: str) -> bool:
        """Email löschen (in Trash verschieben)"""
        try:
            self.service.users().messages().trash(userId='me', id=email_id).execute()
            print(f"🗑️  Email gelöscht: {email_id}")
            return True
        except HttpError as error:
            print(f"❌ Fehler beim Löschen: {error}")
            return False
    
    def create_label(self, label_name: str) -> str:
        """Gmail Label erstellen"""
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
            
            print(f"🏷️  Label erstellt: {label_name}")
            return label['id']
            
        except HttpError as error:
            if 'Label name exists' in str(error):
                # Label existiert bereits
                labels = self.service.users().labels().list(userId='me').execute()
                for label in labels['labels']:
                    if label['name'] == label_name:
                        return label['id']
            print(f"❌ Fehler beim Label erstellen: {error}")
            return ""
    
    def add_label_to_email(self, email_id: str, label_id: str):
        """Label zu Email hinzufügen"""
        try:
            self.service.users().messages().modify(
                userId='me',
                id=email_id,
                body={'addLabelIds': [label_id]}
            ).execute()
        except HttpError as error:
            print(f"❌ Fehler beim Label hinzufügen: {error}")
    
    def analyze_inbox(self, days_back: int = 30) -> Dict:
        """Inbox analysieren und Report erstellen"""
        print(f"🔍 Analysiere Inbox der letzten {days_back} Tage...")
        
        # Query für letzte X Tage
        date_query = f"newer_than:{days_back}d"
        
        # Alle Emails abrufen
        emails = self.get_emails(query=date_query, max_results=500)
        
        analysis = {
            'total_emails': len(emails),
            'newsletters': [],
            'large_emails': [],
            'old_emails': [],
            'total_size_mb': 0
        }
        
        print(f"📊 Verarbeite {len(emails)} Emails...")
        
        for i, email in enumerate(emails):
            if i % 50 == 0:
                print(f"   Progress: {i}/{len(emails)}")
            
            details = self.get_email_details(email['id'])
            if not details:
                continue
            
            analysis['total_size_mb'] += details['size_mb']
            
            # Newsletter prüfen
            if self.is_newsletter(details):
                unsubscribe_link = self.find_unsubscribe_link(details)
                analysis['newsletters'].append({
                    'id': details['id'],
                    'from': details['from'],
                    'subject': details['subject'],
                    'unsubscribe_link': unsubscribe_link,
                    'size_mb': details['size_mb']
                })
            
            # Große Emails (>5MB)
            if details['size_mb'] > 5:
                analysis['large_emails'].append({
                    'id': details['id'],
                    'from': details['from'],
                    'subject': details['subject'],
                    'size_mb': details['size_mb']
                })
            
            # Rate limiting
            time.sleep(0.1)
        
        return analysis
    
    def clean_inbox(self, auto_unsubscribe: bool = False, auto_delete: bool = False):
        """Hauptfunktion: Inbox aufräumen"""
        print("🧹 Email Cleaner gestartet!")
        
        if not self.authenticate_gmail():
            return
        
        # Inbox analysieren
        analysis = self.analyze_inbox(days_back=30)
        
        print(f"\n📊 ANALYSIS REPORT:")
        print(f"   📧 Emails insgesamt: {analysis['total_emails']}")
        print(f"   📰 Newsletter gefunden: {len(analysis['newsletters'])}")
        print(f"   💾 Große Emails (>5MB): {len(analysis['large_emails'])}")
        print(f"   📏 Gesamtgröße: {analysis['total_size_mb']:.2f} MB")
        
        # Newsletter Label erstellen
        newsletter_label_id = self.create_label("🤖 Auto-Newsletter")
        
        # Newsletter verarbeiten
        if analysis['newsletters']:
            print(f"\n📰 Verarbeite {len(analysis['newsletters'])} Newsletter...")
            
            for newsletter in analysis['newsletters']:
                print(f"\n--- {newsletter['subject'][:50]}... ---")
                print(f"Von: {newsletter['from']}")
                
                # Label hinzufügen
                if newsletter_label_id:
                    self.add_label_to_email(newsletter['id'], newsletter_label_id)
                
                # Unsubscribe versuchen
                if auto_unsubscribe and newsletter['unsubscribe_link']:
                    if self.unsubscribe_safely(newsletter['unsubscribe_link']):
                        self.stats['unsubscribed'] += 1
                
                # Löschen
                if auto_delete:
                    if self.delete_email(newsletter['id']):
                        self.stats['deleted'] += 1
                        self.stats['space_freed_mb'] += newsletter['size_mb']
                
                self.stats['newsletters_found'] += 1
                time.sleep(1)  # Rate limiting
        
        # Abschlussbericht
        print(f"\n✅ EMAIL CLEANER FERTIG!")
        print(f"   📰 Newsletter gefunden: {self.stats['newsletters_found']}")
        print(f"   🚫 Abgemeldet: {self.stats['unsubscribed']}")
        print(f"   🗑️  Gelöscht: {self.stats['deleted']}")
        print(f"   💾 Speicher befreit: {self.stats['space_freed_mb']:.2f} MB")
        
        # Analysis als JSON speichern
        with open('email_analysis.json', 'w', encoding='utf-8') as f:
            json.dump(analysis, f, ensure_ascii=False, indent=2)
        
        print("📁 Detailanalyse in email_analysis.json gespeichert")

# Verwendung
if __name__ == "__main__":
    cleaner = EmailCleaner()
    
    print("🤖 Smart Email Cleaner")
    print("=" * 50)
    
    print("\nModi:")
    print("1. Nur analysieren (sicher)")
    print("2. Analysieren + Labeln")
    print("3. Analysieren + Labeln + Unsubscribe")
    print("4. FULL CLEAN (Analysieren + Unsubscribe + Löschen)")
    
    mode = input("\nModus wählen (1-4): ").strip()
    
    if mode == "1":
        cleaner.clean_inbox(auto_unsubscribe=False, auto_delete=False)
    elif mode == "2":
        cleaner.clean_inbox(auto_unsubscribe=False, auto_delete=False)
    elif mode == "3":
        cleaner.clean_inbox(auto_unsubscribe=True, auto_delete=False)
    elif mode == "4":
        confirm = input("⚠️  WARNUNG: Emails werden gelöscht! Fortfahren? (yes/no): ")
        if confirm.lower() == "yes":
            cleaner.clean_inbox(auto_unsubscribe=True, auto_delete=True)
    else:
        print("❌ Ungültiger Modus")