/**
 * Charts Module - Specialized chart creation and management
 * Uses Chart.js for data visualization
 */

window.Charts = (function() {
    'use strict';

    // Chart configuration constants
    const CHART_COLORS = {
        primary: '#3498db',
        secondary: '#e74c3c',
        success: '#2ecc71',
        warning: '#f39c12',
        info: '#17a2b8',
        light: '#f8f9fa',
        dark: '#343a40'
    };

    const CHART_DEFAULTS = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    padding: 20,
                    usePointStyle: true,
                    font: {
                        size: 12,
                        family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
                    }
                }
            },
            tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                titleColor: '#fff',
                bodyColor: '#fff',
                borderColor: '#3498db',
                borderWidth: 1,
                cornerRadius: 8,
                padding: 12
            }
        },
        animation: {
            duration: 1000,
            easing: 'easeInOutQuart'
        }
    };

    /**
     * Create email distribution donut chart
     */
    function createEmailDistributionChart(data) {
        const ctx = document.getElementById('emailDistributionChart');
        if (!ctx) {
            console.error('Email distribution chart canvas not found');
            return null;
        }

        const newsletterCount = data.newsletters?.length || 0;
        const totalEmails = data.total_emails || 0;
        const regularEmails = Math.max(0, totalEmails - newsletterCount);

        // Calculate percentages
        const newsletterPercentage = totalEmails > 0 ? ((newsletterCount / totalEmails) * 100).toFixed(1) : 0;
        const regularPercentage = totalEmails > 0 ? ((regularEmails / totalEmails) * 100).toFixed(1) : 0;

        const chartData = {
            labels: [
                `Newsletter (${newsletterPercentage}%)`,
                `Normale Emails (${regularPercentage}%)`
            ],
            datasets: [{
                data: [newsletterCount, regularEmails],
                backgroundColor: [
                    CHART_COLORS.secondary,
                    CHART_COLORS.primary
                ],
                borderWidth: 0,
                hoverOffset: 10
            }]
        };

        const config = {
            type: 'doughnut',
            data: chartData,
            options: {
                ...CHART_DEFAULTS,
                cutout: '60%',
                plugins: {
                    ...CHART_DEFAULTS.plugins,
                    legend: {
                        ...CHART_DEFAULTS.plugins.legend,
                        position: 'bottom'
                    },
                    tooltip: {
                        ...CHART_DEFAULTS.plugins.tooltip,
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                return `${label}: ${value.toLocaleString()} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        };

        return new Chart(ctx, config);
    }

    /**
     * Create storage analysis bar chart
     */
    function createStorageAnalysisChart(data) {
        const ctx = document.getElementById('storageAnalysisChart');
        if (!ctx) {
            console.error('Storage analysis chart canvas not found');
            return null;
        }

        const newsletters = data.newsletters || [];
        const newsletterSize = newsletters.reduce((sum, n) => sum + (n.size_mb || 0), 0);
        const totalSize = data.total_size_mb || 0;
        const regularSize = Math.max(0, totalSize - newsletterSize);

        // Calculate percentages
        const newsletterSizePercentage = totalSize > 0 ? ((newsletterSize / totalSize) * 100).toFixed(1) : 0;
        const regularSizePercentage = totalSize > 0 ? ((regularSize / totalSize) * 100).toFixed(1) : 0;

        const chartData = {
            labels: ['Newsletter', 'Normale Emails'],
            datasets: [{
                label: 'Speicherverbrauch (MB)',
                data: [newsletterSize, regularSize],
                backgroundColor: [
                    CHART_COLORS.secondary,
                    CHART_COLORS.success
                ],
                borderColor: [
                    CHART_COLORS.secondary,
                    CHART_COLORS.success
                ],
                borderWidth: 2,
                borderRadius: 8,
                borderSkipped: false,
            }]
        };

        const config = {
            type: 'bar',
            data: chartData,
            options: {
                ...CHART_DEFAULTS,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Größe (MB)',
                            font: {
                                size: 12,
                                weight: 'bold'
                            }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        },
                        ticks: {
                            callback: function(value) {
                                return value.toFixed(1) + ' MB';
                            }
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                },
                plugins: {
                    ...CHART_DEFAULTS.plugins,
                    legend: {
                        display: false
                    },
                    tooltip: {
                        ...CHART_DEFAULTS.plugins.tooltip,
                        callbacks: {
                            label: function(context) {
                                const value = context.parsed.y;
                                const percentage = context.dataIndex === 0 ? newsletterSizePercentage : regularSizePercentage;
                                return `${context.label}: ${value.toFixed(1)} MB (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        };

        return new Chart(ctx, config);
    }

    /**
     * Create sender analysis chart (for future use)
     */
    function createSenderAnalysisChart(data) {
        const newsletters = data.newsletters || [];
        if (newsletters.length === 0) return null;

        // Analyze senders
        const senderCount = {};
        newsletters.forEach(newsletter => {
            const sender = newsletter.from || 'Unbekannt';
            // Extract domain from email
            const domain = sender.includes('@') ? sender.split('@')[1] : sender;
            senderCount[domain] = (senderCount[domain] || 0) + 1;
        });

        // Get top 5 senders
        const topSenders = Object.entries(senderCount)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5);

        const chartData = {
            labels: topSenders.map(([domain]) => domain),
            datasets: [{
                label: 'Anzahl Newsletter',
                data: topSenders.map(([, count]) => count),
                backgroundColor: [
                    CHART_COLORS.primary,
                    CHART_COLORS.secondary,
                    CHART_COLORS.success,
                    CHART_COLORS.warning,
                    CHART_COLORS.info
                ],
                borderWidth: 0
            }]
        };

        return {
            type: 'horizontalBar',
            data: chartData,
            options: CHART_DEFAULTS
        };
    }

    /**
     * Create timeline chart showing newsletter frequency over time
     */
    function createTimelineChart(data) {
        const newsletters = data.newsletters || [];
        if (newsletters.length === 0) return null;

        // Group newsletters by date
        const dateCount = {};
        newsletters.forEach(newsletter => {
            const date = newsletter.date || new Date().toISOString().split('T')[0];
            dateCount[date] = (dateCount[date] || 0) + 1;
        });

        // Sort by date and get last 30 days
        const sortedDates = Object.entries(dateCount)
            .sort(([a], [b]) => new Date(a) - new Date(b))
            .slice(-30);

        const chartData = {
            labels: sortedDates.map(([date]) => {
                return new Date(date).toLocaleDateString('de-DE', {
                    month: 'short',
                    day: 'numeric'
                });
            }),
            datasets: [{
                label: 'Newsletter pro Tag',
                data: sortedDates.map(([, count]) => count),
                borderColor: CHART_COLORS.primary,
                backgroundColor: CHART_COLORS.primary + '20',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        };

        return {
            type: 'line',
            data: chartData,
            options: {
                ...CHART_DEFAULTS,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Anzahl Newsletter'
                        }
                    }
                }
            }
        };
    }

    /**
     * Destroy all charts to prevent memory leaks
     */
    function destroyChart(chart) {
        if (chart && typeof chart.destroy === 'function') {
            chart.destroy();
        }
    }

    /**
     * Utility function to format numbers for charts
     */
    function formatNumber(num, decimals = 1) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(decimals) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(decimals) + 'K';
        }
        return num.toFixed(decimals);
    }

    /**
     * Get responsive font size based on screen width
     */
    function getResponsiveFontSize() {
        const width = window.innerWidth;
        if (width < 480) return 10;
        if (width < 768) return 11;
        return 12;
    }

    /**
     * Update chart defaults for responsive design
     */
    function updateChartsForMobile() {
        const isMobile = window.innerWidth < 768;
        
        if (isMobile) {
            Chart.defaults.font.size = getResponsiveFontSize();
            Chart.defaults.plugins.legend.labels.padding = 10;
        }
    }

    // Listen for window resize to update charts
    window.addEventListener('resize', () => {
        updateChartsForMobile();
    });

    // Initialize responsive settings
    updateChartsForMobile();

    // Public API
    return {
        createEmailDistributionChart,
        createStorageAnalysisChart,
        createSenderAnalysisChart,
        createTimelineChart,
        destroyChart,
        formatNumber,
        CHART_COLORS,
        CHART_DEFAULTS
    };

})();

// Initialize Chart.js defaults
Chart.defaults.font.family = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
Chart.defaults.color = '#333';
Chart.defaults.borderColor = 'rgba(0, 0, 0, 0.1)';

console.log('📊 Charts module loaded');