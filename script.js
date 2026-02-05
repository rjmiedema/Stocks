const CORS_PROXY = "https://corsproxy.io/?url=";
const RSS_FEED_URL = "https://www.reddit.com/r/stocks.rss";
const REFRESH_INTERVAL = 60000; // 60 seconds

const parser = new RSSParser();
const feedDiv = document.getElementById('feed');
const lastUpdateDiv = document.getElementById('last-update');

async function fetchNews() {
    try {
        // Show loading state
        const refreshIndicator = document.getElementById('refresh-indicator');
        refreshIndicator.style.opacity = '1';

        const fullUrl = CORS_PROXY + encodeURIComponent(RSS_FEED_URL);
        const feed = await parser.parseURL(fullUrl);

        // Clear previous content
        feedDiv.innerHTML = '';

        // Add articles
        if (feed.items && feed.items.length > 0) {
            feed.items.slice(0, 30).forEach((item, index) => {
                const articleHTML = `
                    <div class="news-item">
                        <a href="${item.link}" target="_blank" rel="noopener noreferrer">
                            <h3>${sanitizeHTML(item.title)}</h3>
                        </a>
                        <div class="meta">
                            <span class="time">${formatTime(item.pubDate)}</span>
                            <span class="source">r/stocks</span>
                        </div>
                    </div>
                `;
                feedDiv.innerHTML += articleHTML;
            });
        } else {
            feedDiv.innerHTML = '<div class="loading-message">No articles found</div>';
        }

        // Update timestamp
        updateTimestamp();
        refreshIndicator.style.opacity = '0.5';

    } catch (error) {
        console.error('Feed fetch error:', error);
        feedDiv.innerHTML = `
            <div class="error-message">
                <strong>⚠️ Error loading news</strong><br>
                ${error.message || 'Unable to fetch the news feed. Please try again later.'}
            </div>
        `;
    }
}

function updateTimestamp() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    lastUpdateDiv.textContent = `Last updated: ${hours}:${minutes}`;
}

function formatTime(dateString) {
    if (!dateString) return 'Unknown time';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
}

function sanitizeHTML(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initial load
fetchNews();

// Refresh every 60 seconds
setInterval(fetchNews, REFRESH_INTERVAL);
