/**
 * Email Cleaner Dashboard - Fixed Professional Version
 * Komplett funktionierende Lösung mit allen Features
 */

class EmailDashboard {
    constructor() {
        this.emailData = null;
        this.charts = {};
        console.log('📧 Email Dashboard initializing...');
        this.init();
    }

    /**
     * Initialize the application
     */
    init() {
        // Sicherstellen dass DOM ready ist
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.bindEvents());
        } else {
            this.bindEvents();
        }
        this.setupDragAndDrop();
        console.log('📧 Email Dashboard initialized');
    }

    /**
     * Bind all event listeners - mit Safety Checks
     */
    bindEvents() {
        try {
            // File input handling
            const fileInput = document.getElementById('fileInput');
            if (fileInput) {
                fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
                console.log('✅ File input bound');
            }

            // Action buttons mit Safety Checks
            const downloadBtn = document.getElementById('downloadReportBtn');
            if (downloadBtn) {
                downloadBtn.addEventListener('click', () => this.downloadReport());
                console.log('✅ Download button bound');
            }

            const cleanupBtn = document.getElementById('cleanupBtn');
            if (cleanupBtn) {
                cleanupBtn.addEventListener('click', () => this.showCleanupOptions());
                console.log('✅ Cleanup button bound');
            }

            const exportBtn = document.getElementById('exportDataBtn');
            if (exportBtn) {
                exportBtn.addEventListener('click', () => this.exportData());
                console.log('✅ Export button bound');
            }

            const demoBtn = document.getElementById('demoButton');
            if (demoBtn) {
                demoBtn.addEventListener('click', () => this.loadDemoData());
                console.log('✅ Demo button bound');
            }

            console.log('✅ All events bound successfully');
        } catch (error) {
            console.error('❌ Error binding events:', error);
        }
    }

    /**
     * Setup drag and drop functionality
     */
    setupDragAndDrop() {
        const uploadArea = document.getElementById('uploadArea');
        if (!uploadArea) return;

        uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
        uploadArea.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        uploadArea.addEventListener('drop', (e) => this.handleDrop(e));
        console.log('✅ Drag & Drop setup complete');
    }

    /**
     * Handle drag over event
     */
    handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        const uploadArea = e.currentTarget;
        uploadArea.classList.add('dragover');
    }

    /**
     * Handle drag leave event
     */
    handleDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();
        const uploadArea = e.currentTarget;
        uploadArea.classList.remove('dragover');
    }

    /**
     * Handle file drop event
     */
    handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        const uploadArea = e.currentTarget;
        uploadArea.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            console.log('📁 File dropped:', files[0].name);
            this.handleFile(files[0]);
        }
    }

    /**
     * Handle file selection from input
     */
    handleFileSelect(e) {
        const file = e.target.files[0];
        if (file) {
            console.log('📁 File selected:', file.name);
            this.handleFile(file);
        }
    }

    /**
     * Process uploaded file
     */
    handleFile(file) {
        // Validate file type
        if (!file.name.endsWith('.json')) {
            this.showError('❌ Bitte eine JSON-Datei auswählen!');
            return;
        }

        console.log('📊 Processing file:', file.name, 'Size:', file.size, 'bytes');

        // Show loading state
        this.showLoading();

        // Read file
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const jsonData = JSON.parse(e.target.result);
                console.log('✅ JSON parsed successfully:', Object.keys(jsonData));
                this.emailData = jsonData;
                this.processEmailData();
            } catch (error) {
                console.error('❌ JSON Parse Error:', error);
                this.showError('❌ Fehler beim Laden der JSON-Datei: ' + error.message);
                this.hideLoading();
            }
        };

        reader.onerror = () => {
            this.showError('❌ Fehler beim Lesen der Datei');
            this.hideLoading();
        };

        reader.readAsText(file);
    }

    /**
     * Process email data and update dashboard
     */
    processEmailData() {
        console.log('📊 Processing email data...');
        
        // Simulate processing time for better UX
        setTimeout(() => {
            this.hideLoading();
            this.showDashboard();
            this.populateDashboard();
            console.log('✅ Dashboard populated with data');
        }, 1000);
    }

    /**
     * Show loading state
     */
    showLoading() {
        const uploadSection = document.querySelector('.upload-section');
        const loadingSection = document.getElementById('loadingSection');
        
        if (uploadSection) uploadSection.style.display = 'none';
        if (loadingSection) loadingSection.style.display = 'block';
    }

    /**
     * Hide loading state
     */
    hideLoading() {
        const loadingSection = document.getElementById('loadingSection');
        if (loadingSection) loadingSection.style.display = 'none';
    }

    /**
     * Show dashboard content
     */
    showDashboard() {
        const dashboardContent = document.getElementById('dashboardContent');
        if (dashboardContent) dashboardContent.style.display = 'block';
    }

    /**
     * Populate dashboard with email data
     */
    populateDashboard() {
        if (!this.emailData) return;

        this.updateStatistics();
        this.renderCharts();
        this.populateNewsletterList();
    }

    /**
     * Update statistics cards
     */
    updateStatistics() {
        const data = this.emailData;
        
        // Calculate metrics
        const totalEmails = data.total_emails || 0;
        const newsletterCount = data.newsletters?.length || 0;
        const totalSize = (data.total_size_mb || 0).toFixed(1);
        const potentialSavings = data.newsletters?.reduce((sum, newsletter) => 
            sum + (newsletter.size_mb || 0), 0) || 0;

        // Update DOM elements safely
        this.updateElement('totalEmails', totalEmails.toLocaleString());
        this.updateElement('newsletterCount', newsletterCount.toLocaleString());
        this.updateElement('totalSize', totalSize);
        this.updateElement('potentialSavings', potentialSavings.toFixed(1));

        console.log('📊 Statistics updated:', {
            totalEmails, newsletterCount, totalSize, potentialSavings: potentialSavings.toFixed(1)
        });

        // Add animation to numbers
        this.animateNumbers();
    }

    /**
     * Update DOM element content safely
     */
    updateElement(id, content) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = content;
        } else {
            console.warn('⚠️ Element not found:', id);
        }
    }

    /**
     * Animate number counters
     */
    animateNumbers() {
        const numberElements = document.querySelectorAll('.stat-number');
        numberElements.forEach((element, index) => {
            element.style.opacity = '0';
            element.style.transform = 'translateY(20px)';
            
            setTimeout(() => {
                element.style.transition = 'all 0.6s ease';
                element.style.opacity = '1';
                element.style.transform = 'translateY(0)';
            }, index * 100);
        });
    }

    /**
     * Render all charts
     */
    renderCharts() {
        console.log('📊 Rendering charts...');
        
        // Destroy existing charts first
        this.destroyExistingCharts();
        
        if (window.Charts) {
            try {
                this.charts.emailDistribution = window.Charts.createEmailDistributionChart(this.emailData);
                this.charts.storageAnalysis = window.Charts.createStorageAnalysisChart(this.emailData);
                console.log('✅ Charts rendered successfully');
            } catch (error) {
                console.error('❌ Error rendering charts:', error);
            }
        } else {
            console.warn('⚠️ Charts module not loaded');
        }
    }

    /**
     * Destroy existing charts to prevent memory leaks
     */
    destroyExistingCharts() {
        Object.values(this.charts).forEach(chart => {
            if (chart && typeof chart.destroy === 'function') {
                chart.destroy();
            }
        });
        this.charts = {};
    }

    /**
     * Populate newsletter list
     */
    populateNewsletterList() {
        const listContainer = document.getElementById('newsletterList');
        if (!listContainer) return;

        const newsletters = this.emailData.newsletters || [];
        
        // Clear existing content
        listContainer.innerHTML = '';

        if (newsletters.length === 0) {
            listContainer.innerHTML = '<div class="newsletter-empty">Keine Newsletter gefunden.</div>';
            return;
        }

        console.log('📰 Populating newsletter list with', newsletters.length, 'newsletters');

        // Display first 10 newsletters
        const displayCount = Math.min(newsletters.length, 10);
        
        for (let i = 0; i < displayCount; i++) {
            const newsletter = newsletters[i];
            const item = this.createNewsletterItem(newsletter);
            listContainer.appendChild(item);
        }

        // Show "more" indicator if needed
        if (newsletters.length > 10) {
            const moreItem = document.createElement('div');
            moreItem.className = 'newsletter-more';
            moreItem.textContent = `... und ${newsletters.length - 10} weitere Newsletter`;
            listContainer.appendChild(moreItem);
        }
    }

    /**
     * Create newsletter item DOM element
     */
    createNewsletterItem(newsletter) {
        const item = document.createElement('div');
        item.className = 'newsletter-item';
        
        const subject = this.sanitizeText(newsletter.subject || 'Kein Betreff');
        const from = this.sanitizeText(newsletter.from || 'Unbekannt');
        const size = (newsletter.size_mb || 0).toFixed(1);
        
        item.innerHTML = `
            <div class="newsletter-info">
                <h4>${subject.substring(0, 60)}${subject.length > 60 ? '...' : ''}</h4>
                <p>Von: ${from}</p>
            </div>
            <div class="newsletter-size">${size} MB</div>
        `;
        
        return item;
    }

    /**
     * Sanitize text for safe HTML insertion
     */
    sanitizeText(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Load demo data for testing
     */
    loadDemoData() {
        console.log('🎮 Loading demo data...');
        
        const demoData = {
            total_emails: 1247,
            total_size_mb: 523.7,
            analysis_date: new Date().toISOString(),
            newsletters: [
                {
                    subject: "Weekly Tech Newsletter - KI & Automation Trends",
                    from: "tech@newsletter.com",
                    size_mb: 2.3,
                    unsubscribe_link: "https://example.com/unsubscribe",
                    date: "2025-07-20"
                },
                {
                    subject: "Marketing Update - Q3 Strategien für 2025",
                    from: "marketing@company.com",
                    size_mb: 1.8,
                    unsubscribe_link: "",
                    date: "2025-07-19"
                },
                {
                    subject: "Daily Digest - Wichtige News aus Tech & Business",
                    from: "news@dailydigest.com",
                    size_mb: 0.9,
                    unsubscribe_link: "https://dailydigest.com/unsubscribe",
                    date: "2025-07-18"
                },
                {
                    subject: "Shopping Deals & Angebote - Wöchentliche Highlights",
                    from: "deals@shop.com",
                    size_mb: 3.1,
                    unsubscribe_link: "https://shop.com/unsubscribe",
                    date: "2025-07-17"
                },
                {
                    subject: "Fitness Weekly - Workout Tips & Gesundheit",
                    from: "fitness@healthapp.com",
                    size_mb: 1.5,
                    unsubscribe_link: "https://healthapp.com/unsubscribe",
                    date: "2025-07-16"
                }
            ],
            large_emails: [
                {
                    subject: "Video Conference Recording - Team Meeting",
                    from: "meetings@company.com",
                    size_mb: 15.2,
                    date: "2025-07-15"
                }
            ]
        };
        
        this.emailData = demoData;
        
        const uploadSection = document.querySelector('.upload-section');
        if (uploadSection) uploadSection.style.display = 'none';
        
        this.showDashboard();
        this.populateDashboard();
        
        console.log('✅ Demo data loaded successfully');
    }

    /**
     * Download detailed report
     */
    downloadReport() {
        if (!this.emailData) {
            this.showError('Keine Daten zum Exportieren verfügbar');
            return;
        }
        
        console.log('📊 Generating report...');
        
        const report = this.generateReport();
        const blob = new Blob([JSON.stringify(report, null, 2)], {
            type: 'application/json'
        });
        
        this.downloadFile(blob, `email_cleaner_report_${this.getCurrentDate()}.json`);
        console.log('✅ Report downloaded');
    }

    /**
     * Generate comprehensive report
     */
    generateReport() {
        const data = this.emailData;
        const newsletterCount = data.newsletters?.length || 0;
        const potentialSavings = data.newsletters?.reduce((sum, n) => sum + (n.size_mb || 0), 0) || 0;
        
        return {
            generated: new Date().toISOString(),
            summary: {
                total_emails: data.total_emails || 0,
                newsletters_found: newsletterCount,
                total_size_mb: data.total_size_mb || 0,
                potential_savings_mb: potentialSavings,
                large_emails_count: data.large_emails?.length || 0
            },
            detailed_analysis: {
                newsletters: data.newsletters || [],
                large_emails: data.large_emails || []
            },
            metadata: {
                analysis_date: data.analysis_date,
                days_analyzed: 30,
                tool_version: "2.0.0"
            }
        };
    }

    /**
     * Show cleanup options
     */
    showCleanupOptions() {
        const options = [
            '🔍 Newsletter automatisch erkennen',
            '📧 Bulk-Unsubscribe durchführen',
            '🗑️ Alte Newsletter löschen',
            '📊 Detaillierte Sender-Analyse',
            '⚡ Smart-Kategorisierung'
        ];
        
        const message = `🚧 Cleanup-Funktionen in Entwicklung!\n\nGeplante Features:\n${options.join('\n')}`;
        alert(message);
        
        console.log('🧹 Cleanup options displayed');
    }

    /**
     * Export data as CSV
     */
    exportData() {
        if (!this.emailData?.newsletters) {
            this.showError('Keine Newsletter-Daten zum Exportieren verfügbar');
            return;
        }
        
        console.log('💾 Exporting data as CSV...');
        
        const csvContent = this.generateCSV();
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        
        this.downloadFile(blob, `newsletter_export_${this.getCurrentDate()}.csv`);
        
        console.log('✅ Data exported as CSV');
    }

    /**
     * Generate CSV content
     */
    generateCSV() {
        const headers = ['Betreff', 'Absender', 'Größe (MB)', 'Unsubscribe Link', 'Datum'];
        const rows = [headers.join(',')];
        
        this.emailData.newsletters.forEach(newsletter => {
            const row = [
                `"${this.escapeCSV(newsletter.subject || '')}"`,
                `"${this.escapeCSV(newsletter.from || '')}"`,
                `"${newsletter.size_mb || 0}"`,
                `"${newsletter.unsubscribe_link || ''}"`,
                `"${newsletter.date || ''}"`
            ];
            rows.push(row.join(','));
        });
        
        return rows.join('\n');
    }

    /**
     * Escape CSV values
     */
    escapeCSV(value) {
        if (typeof value !== 'string') return value;
        return value.replace(/"/g, '""');
    }

    /**
     * Utility: Get current date string
     */
    getCurrentDate() {
        return new Date().toISOString().split('T')[0];
    }

    /**
     * Utility: Download file
     */
    downloadFile(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
    }

    /**
     * Show error message
     */
    showError(message) {
        alert(message);
        console.error('❌ Error:', message);
    }

    /**
     * Cleanup method for destroying charts and event listeners
     */
    destroy() {
        this.destroyExistingCharts();
        this.emailData = null;
        console.log('🧹 Dashboard destroyed');
    }
}

// Application Initialization - mit verbesserter Logik
let dashboardApp;

// Sicherstellen dass App immer startet
function initializeDashboard() {
    try {
        dashboardApp = new EmailDashboard();
        console.log('🚀 Email Cleaner Dashboard loaded successfully');
    } catch (error) {
        console.error('❌ Failed to initialize dashboard:', error);
    }
}

// Mehrere Fallback-Methoden für Initialisierung
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeDashboard);
} else {
    // DOM bereits ready, sofort starten
    initializeDashboard();
}

// Zusätzlicher Fallback falls DOMContentLoaded nicht feuert
setTimeout(() => {
    if (!dashboardApp) {
        console.log('⚠️ Fallback initialization triggered');
        initializeDashboard();
    }
}, 100);

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (dashboardApp) {
        dashboardApp.destroy();
    }
});