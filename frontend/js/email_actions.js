/**
 * Email Actions - Live Gmail Integration
 * Erweitert die EmailDashboard-Klasse um echte Gmail-Aktionen
 */

// EmailAPI Klasse für Backend-Kommunikation
class EmailAPI {
    static async request(endpoint, options = {}) {
        try {
            const response = await fetch(`http://localhost:5000/api${endpoint}`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('API Request failed:', error);
            throw error;
        }
    }
    
    static async healthCheck() {
        return this.request('/health');
    }
    
    static async deleteEmail(emailId) {
        return this.request(`/email/${emailId}/delete`, { method: 'POST' });
    }
    
    static async unsubscribeEmail(emailId) {
        return this.request(`/email/${emailId}/unsubscribe`, { method: 'POST' });
    }
    
    static async bulkDelete(emailIds) {
        return this.request('/bulk-delete', {
            method: 'POST',
            body: JSON.stringify({ email_ids: emailIds })
        });
    }
    
    static async bulkUnsubscribe(emailIds) {
        return this.request('/bulk-unsubscribe', {
            method: 'POST',
            body: JSON.stringify({ email_ids: emailIds })
        });
    }
}

// Warten bis EmailDashboard geladen ist
document.addEventListener('DOMContentLoaded', function() {
    // Kurz warten bis dashboardApp initialisiert ist
    setTimeout(function() {
        if (typeof dashboardApp !== 'undefined' && dashboardApp) {
            console.log('🔗 Extending dashboard with live email actions...');
            
            // API-Verbindung prüfen
            EmailAPI.healthCheck()
                .then(response => {
                    console.log('🌐 API Connection:', response.gmail_connected ? '✅' : '❌');
                    addAPIStatusIndicator(response.gmail_connected);
                    
                    if (response.gmail_connected) {
                        extendDashboardWithLiveActions();
                    }
                })
                .catch(error => {
                    console.log('❌ API not available:', error);
                    addAPIStatusIndicator(false);
                });
        } else {
            console.log('⚠️ dashboardApp not found, retrying...');
            // Noch einmal versuchen nach weiteren 2 Sekunden
            setTimeout(arguments.callee, 2000);
        }
    }, 1000);
});

function addAPIStatusIndicator(isConnected) {
    const header = document.querySelector('.header');
    if (header) {
        let statusDiv = document.getElementById('apiStatus');
        if (!statusDiv) {
            statusDiv = document.createElement('div');
            statusDiv.id = 'apiStatus';
            statusDiv.style.cssText = `
                margin-top: 10px;
                padding: 8px 16px;
                border-radius: 20px;
                font-size: 0.9rem;
                display: inline-block;
            `;
            header.appendChild(statusDiv);
        }
        
        if (isConnected) {
            statusDiv.innerHTML = '🟢 Live Actions verfügbar';
            statusDiv.style.background = 'rgba(46, 204, 113, 0.2)';
            statusDiv.style.color = 'white';
        } else {
            statusDiv.innerHTML = '🔴 Nur Analyse-Modus';
            statusDiv.style.background = 'rgba(231, 76, 60, 0.2)';
            statusDiv.style.color = 'white';
        }
    }
}

function extendDashboardWithLiveActions() {
    // Delete-Funktion hinzufügen
    dashboardApp.deleteEmail = async function(emailId) {
        if (!confirm('Email wirklich löschen?')) return;
        
        try {
            console.log('🗑️ Deleting email:', emailId);
            const result = await EmailAPI.deleteEmail(emailId);
            
            if (result.success) {
                alert('✅ Email erfolgreich gelöscht!');
                // Email aus DOM entfernen
                const emailElement = document.querySelector(`[data-email-id="${emailId}"]`);
                if (emailElement) {
                    emailElement.style.opacity = '0.5';
                    emailElement.style.textDecoration = 'line-through';
                    setTimeout(() => emailElement.remove(), 1000);
                }
            } else {
                alert('❌ Fehler beim Löschen: ' + result.message);
            }
        } catch (error) {
            alert('❌ Fehler: ' + error.message);
        }
    };
    
    // Unsubscribe-Funktion hinzufügen
    dashboardApp.unsubscribeEmail = async function(emailId) {
        if (!confirm('Von diesem Newsletter abmelden?')) return;
        
        try {
            console.log('📧 Unsubscribing from:', emailId);
            const result = await EmailAPI.unsubscribeEmail(emailId);
            
            if (result.success) {
                alert('✅ ' + result.message);
                const emailElement = document.querySelector(`[data-email-id="${emailId}"]`);
                if (emailElement) {
                    emailElement.style.opacity = '0.5';
                    emailElement.style.background = '#d4edda';
                    setTimeout(() => emailElement.remove(), 1500);
                }
            } else {
                alert('❌ Abmeldung fehlgeschlagen: ' + result.error);
            }
        } catch (error) {
            alert('❌ Fehler: ' + error.message);
        }
    };
    
    // Erweiterte Cleanup-Optionen überschreiben
    const originalShowCleanupOptions = dashboardApp.showCleanupOptions;
    dashboardApp.showCleanupOptions = function() {
        const newsletters = this.emailData?.newsletters || [];
        if (newsletters.length === 0) {
            alert('Keine Newsletter-Daten verfügbar');
            return;
        }
        
        const withUnsubscribe = newsletters.filter(n => n.unsubscribe_link).length;
        
        const choice = prompt(
            `🧹 LIVE EMAIL CLEANUP:\n\n` +
            `📰 ${newsletters.length} Newsletter gefunden\n` +
            `📧 ${withUnsubscribe} mit Abmelde-Link\n\n` +
            `Optionen:\n` +
            `1 = Von ${withUnsubscribe} Newsletter abmelden\n` +
            `2 = Alle ${newsletters.length} Newsletter löschen\n` +
            `3 = Nur Demo (keine echten Aktionen)\n\n` +
            `Deine Wahl (1-3):`
        );
        
        if (choice === '1') {
            this.bulkUnsubscribe();
        } else if (choice === '2') {
            this.bulkDelete();
        } else if (choice === '3') {
            // Fallback zur Original-Funktion
            originalShowCleanupOptions.call(this);
        }
    };
    
    // Bulk-Unsubscribe
    dashboardApp.bulkUnsubscribe = async function() {
        const newsletters = this.emailData?.newsletters || [];
        const emailIds = newsletters
            .filter(n => n.unsubscribe_link && n.id)
            .map(n => n.id);
        
        if (emailIds.length === 0) {
            alert('Keine Newsletter mit Abmelde-Links gefunden');
            return;
        }
        
        if (!confirm(`Von ${emailIds.length} Newslettern abmelden? Das kann einige Minuten dauern.`)) return;
        
        try {
            // Progress-Indikator
            const progressDiv = document.createElement('div');
            progressDiv.id = 'progressIndicator';
            progressDiv.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(0,0,0,0.8);
                color: white;
                padding: 20px;
                border-radius: 10px;
                z-index: 10000;
                text-align: center;
            `;
            progressDiv.innerHTML = '📧 Abmeldung läuft...<br><small>Bitte nicht schließen</small>';
            document.body.appendChild(progressDiv);
            
            console.log('📧 Starting bulk unsubscribe for', emailIds.length, 'emails');
            const result = await EmailAPI.bulkUnsubscribe(emailIds);
            
            progressDiv.remove();
            alert(`✅ Abmeldung abgeschlossen!\nErfolgreich: ${result.successful_unsubscribes}/${result.total_processed}`);
            
            // Seite neu laden für aktualisierte Daten
            if (confirm('Seite neu laden um Änderungen zu sehen?')) {
                location.reload();
            }
        } catch (error) {
            document.getElementById('progressIndicator')?.remove();
            alert('❌ Fehler bei Bulk-Abmeldung: ' + error.message);
        }
    };
    
    // Bulk-Delete  
    dashboardApp.bulkDelete = async function() {
        const newsletters = this.emailData?.newsletters || [];
        const emailIds = newsletters.filter(n => n.id).map(n => n.id);
        
        if (emailIds.length === 0) {
            alert('Keine Email-IDs gefunden');
            return;
        }
        
        if (!confirm(`${emailIds.length} Newsletter wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden!`)) return;
        
        try {
            // Progress-Indikator
            const progressDiv = document.createElement('div');
            progressDiv.id = 'progressIndicator';
            progressDiv.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(0,0,0,0.8);
                color: white;
                padding: 20px;
                border-radius: 10px;
                z-index: 10000;
                text-align: center;
            `;
            progressDiv.innerHTML = '🗑️ Löschung läuft...<br><small>Bitte nicht schließen</small>';
            document.body.appendChild(progressDiv);
            
            console.log('🗑️ Starting bulk delete for', emailIds.length, 'emails');
            const result = await EmailAPI.bulkDelete(emailIds);
            
            progressDiv.remove();
            alert(`✅ Löschen abgeschlossen!\nErfolgreich: ${result.successful_deletions}/${result.total_processed}`);
            
            // Seite neu laden für aktualisierte Daten
            if (confirm('Seite neu laden um Änderungen zu sehen?')) {
                location.reload();
            }
        } catch (error) {
            document.getElementById('progressIndicator')?.remove();
            alert('❌ Fehler beim Bulk-Löschen: ' + error.message);
        }
    };
    
    console.log('✅ Live email actions loaded successfully!');
    console.log('Available actions:', Object.keys(dashboardApp).filter(key => 
        ['deleteEmail', 'unsubscribeEmail', 'bulkUnsubscribe', 'bulkDelete'].includes(key)
    ));
}

// Global verfügbar machen für Debugging
window.EmailAPI = EmailAPI;