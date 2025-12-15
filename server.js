const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;

// Add fetch for Node.js self-ping functionality


// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname));

// Simple in-memory storage for testing
let users = [];
let userIdCounter = 1;

// ===== SELF-PING FUNCTIONALITY =====


function getAppUrl() {
    // Try to detect the hosting platform and get the correct URL
    if (process.env.RAILWAY_STATIC_URL) {
        return `https://${process.env.RAILWAY_STATIC_URL}`;
    } else if (process.env.RENDER_EXTERNAL_URL) {
        return process.env.RENDER_EXTERNAL_URL;
    } else if (process.env.HEROKU_APP_NAME) {
        return `https://${process.env.HEROKU_APP_NAME}.herokuapp.com`;
    } else if (process.env.VERCEL_URL) {
        return `https://${process.env.VERCEL_URL}`;
    } else {
        // Fallback for local development
        return `http://localhost:${PORT}`;
    }
}

async function selfPing() {
    try {
        const startTime = Date.now();
        const response = await fetch(`${appUrl}/api/health`, {
            method: 'GET',
            timeout: 5000, // 5 second timeout
            headers: {
                'User-Agent': 'MystiQ-KeepAlive/1.0'
            }
        });
        
        const responseTime = Date.now() - startTime;
        
        if (response.ok) {
            console.log(`🟢 Self-ping successful (${responseTime}ms) - Server staying awake`);
        } else {
            console.log(`🟡 Self-ping responded with status ${response.status} (${responseTime}ms)`);
        }
    } catch (error) {
        console.log(`🔴 Self-ping failed: ${error.message}`);
    }
}

function startSelfPing() {
    appUrl = getAppUrl();
    console.log(`🔄 Starting self-ping to: ${appUrl}`);
    console.log(`⏰ Ping interval: ${SELF_PING_INTERVAL / 1000} seconds`);
    
    // First ping after 30 seconds (give server time to fully start)
    setTimeout(() => {
        selfPing();
        
        // Then ping every 10 seconds
        selfPingInterval = setInterval(selfPing, SELF_PING_INTERVAL);
    }, 30000);
}

function stopSelfPing() {
    if (selfPingInterval) {
        clearInterval(selfPingInterval);
        selfPingInterval = null;
        console.log('⏹️ Self-ping stopped');
    }
}

// Helper functions
function generateReferralCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function calculatePriorityScore(userData) {
    let score = 0;
    if (userData.teaser_answer && userData.teaser_answer.length > 20) score += 10;
    if (userData.instagram) score += 5;
    if (userData.referred_by) score += 15;
    return score;
}

function getQueuePosition(email) {
    const user = users.find(u => u.email === email);
    if (!user) return -1;
    
    const higherPriorityUsers = users.filter(u => 
        u.priority_score > user.priority_score || 
        (u.priority_score === user.priority_score && u.created_at < user.created_at)
    );
    
    return higherPriorityUsers.length + 1;
}

// Basic auth middleware for admin routes
const basicAuth = (req, res, next) => {
    const auth = req.headers.authorization;
    
    if (!auth || !auth.startsWith('Basic ')) {
        res.setHeader('WWW-Authenticate', 'Basic realm="Admin"');
        return res.status(401).send('Authentication required');
    }
    
    const credentials = Buffer.from(auth.slice(6), 'base64').toString().split(':');
    const username = credentials[0];
    const password = credentials[1];
    
    // Simple hardcoded credentials (use environment variables in production)
    if (username === 'admin' && password === 'mystiq123') {
        next();
    } else {
        res.setHeader('WWW-Authenticate', 'Basic realm="Admin"');
        res.status(401).send('Invalid credentials');
    }
};

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/test.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'test.html'));
});

// Protect admin.html
app.get('/admin.html', basicAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Health check (enhanced to detect self-ping)
app.get('/api/health', (req, res) => {
    const userAgent = req.headers['user-agent'] || '';
    const isKeepAlive = userAgent.includes('MystiQ-KeepAlive');
    
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        users_count: users.length,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        keep_alive_ping: isKeepAlive
    });
});

// Register user
app.post('/api/register', (req, res) => {
    try {
        console.log('📝 Registration request received:', req.body);
        
        const { email, college_name, age, city, instagram, teaser_answer, referred_by } = req.body;

        // Validate required fields
        if (!email || !college_name || !age || !city) {
            console.log('❌ Missing required fields');
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Check if email is college email
        const collegeEmailPattern = /\.(edu|ac\.|edu\.)/;
        if (!collegeEmailPattern.test(email)) {
            console.log('❌ Invalid college email:', email);
            return res.status(400).json({ error: 'Please use your college email address' });
        }

        // Check if user already exists
        const existingUser = users.find(u => u.email === email);
        if (existingUser) {
            console.log('❌ Email already registered:', email);
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Create new user
        const referralCode = generateReferralCode();
        const priorityScore = calculatePriorityScore(req.body);
        
        const newUser = {
            id: userIdCounter++,
            email,
            college_name,
            age: parseInt(age),
            city,
            instagram: instagram || null,
            teaser_answer: teaser_answer || null,
            referral_code: referralCode,
            referred_by: referred_by || null,
            priority_score: priorityScore,
            referral_count: 0,
            created_at: new Date().toISOString(),
            status: 'pending'
        };

        users.push(newUser);

        // Update referrer if applicable
        if (referred_by) {
            const referrer = users.find(u => u.referral_code === referred_by);
            if (referrer) {
                referrer.referral_count += 1;
                referrer.priority_score += 20;
                console.log('✅ Updated referrer:', referrer.email);
            } else {
                console.log('⚠️ Referral code not found:', referred_by);
            }
        }

        const queuePosition = getQueuePosition(email);
        const totalUsers = users.length;

        console.log('✅ User registered successfully:', {
            email,
            queuePosition,
            totalUsers,
            referralCode
        });

        res.json({
            success: true,
            referralCode: referralCode,
            queuePosition: queuePosition,
            totalUsers: totalUsers,
            priorityScore: priorityScore
        });

    } catch (error) {
        console.error('💥 Registration error:', error);
        res.status(500).json({ error: 'Registration failed: ' + error.message });
    }
});

// Get queue status
app.get('/api/queue/:email', (req, res) => {
    try {
        const { email } = req.params;
        const user = users.find(u => u.email === email);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const queuePosition = getQueuePosition(email);
        const totalUsers = users.length;

        res.json({
            queuePosition: queuePosition,
            totalUsers: totalUsers,
            referralCode: user.referral_code,
            referralCount: user.referral_count,
            priorityScore: user.priority_score
        });

    } catch (error) {
        console.error('Queue status error:', error);
        res.status(500).json({ error: 'Failed to get queue status' });
    }
});

// ===== ADMIN ENDPOINTS =====

// Get statistics
app.get('/api/admin/stats', basicAuth, (req, res) => {
    try {
        const totalUsers = users.length;
        const answeredTeaser = users.filter(u => u.teaser_answer && u.teaser_answer.length > 0).length;
        const referredUsers = users.filter(u => u.referred_by).length;
        const avgPriorityScore = totalUsers > 0 ? 
            users.reduce((sum, u) => sum + u.priority_score, 0) / totalUsers : 0;

        res.json({
            total_users: totalUsers,
            answered_teaser: answeredTeaser,
            referred_users: referredUsers,
            avg_priority_score: avgPriorityScore,
            has_instagram: users.filter(u => u.instagram).length,
            pending_users: users.filter(u => u.status === 'pending').length,
            approved_users: users.filter(u => u.status === 'approved').length
        });
    } catch (error) {
        console.error('Error getting stats:', error);
        res.status(500).json({ error: 'Failed to get stats' });
    }
});

// Get all users
app.get('/api/admin/users', basicAuth, (req, res) => {
    try {
        // Sort users by priority score (desc) and creation date (asc)
        const sortedUsers = [...users].sort((a, b) => {
            if (b.priority_score !== a.priority_score) {
                return b.priority_score - a.priority_score;
            }
            return new Date(a.created_at) - new Date(b.created_at);
        });

        res.json({
            total: sortedUsers.length,
            users: sortedUsers
        });
    } catch (error) {
        console.error('Error getting users:', error);
        res.status(500).json({ error: 'Failed to get users' });
    }
});

// Get user by email
app.get('/api/admin/user/:email', basicAuth, (req, res) => {
    try {
        const { email } = req.params;
        const user = users.find(u => u.email === email);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(user);
    } catch (error) {
        console.error('Error getting user:', error);
        res.status(500).json({ error: 'Failed to get user' });
    }
});

// Get referrals
app.get('/api/admin/referrals', basicAuth, (req, res) => {
    try {
        const referrals = [];
        
        users.forEach(user => {
            if (user.referred_by) {
                const referrer = users.find(u => u.referral_code === user.referred_by);
                if (referrer) {
                    referrals.push({
                        id: referrals.length + 1,
                        referrer_email: referrer.email,
                        referred_email: user.email,
                        referrer_code: referrer.referral_code,
                        referred_college: user.college_name,
                        created_at: user.created_at
                    });
                }
            }
        });

        // Sort by creation date (newest first)
        referrals.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        res.json(referrals);
    } catch (error) {
        console.error('Error getting referrals:', error);
        res.status(500).json({ error: 'Failed to get referrals' });
    }
});

// Update user status
app.put('/api/admin/user/:email/status', basicAuth, (req, res) => {
    try {
        const { email } = req.params;
        const { status } = req.body;
        
        const user = users.find(u => u.email === email);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        user.status = status;
        console.log(`✅ Updated user ${email} status to ${status}`);
        
        res.json({ success: true, message: `User status updated to ${status}` });
    } catch (error) {
        console.error('Error updating user status:', error);
        res.status(500).json({ error: 'Failed to update user status' });
    }
});

// Bulk update users
app.put('/api/admin/users/bulk', basicAuth, (req, res) => {
    try {
        const { emails, action, value } = req.body;
        
        if (!emails || !Array.isArray(emails) || emails.length === 0) {
            return res.status(400).json({ error: 'No emails provided' });
        }

        let updatedCount = 0;
        
        emails.forEach(email => {
            const user = users.find(u => u.email === email);
            if (user) {
                switch(action) {
                    case 'status':
                        user.status = value;
                        break;
                    case 'priority_boost':
                        user.priority_score += (value || 10);
                        break;
                    case 'delete':
                        const index = users.findIndex(u => u.email === email);
                        if (index > -1) {
                            users.splice(index, 1);
                        }
                        break;
                }
                updatedCount++;
            }
        });

        res.json({ 
            success: true, 
            message: `${action} applied to ${updatedCount} users`,
            updated_count: updatedCount 
        });
    } catch (error) {
        console.error('Error in bulk update:', error);
        res.status(500).json({ error: 'Failed to perform bulk update' });
    }
});

// Clear database (dangerous!)
app.delete('/api/admin/clear', basicAuth, (req, res) => {
    try {
        const { confirm } = req.body;
        
        if (confirm !== 'DELETE') {
            return res.status(400).json({ error: 'Confirmation required' });
        }

        const userCount = users.length;
        users = [];
        userIdCounter = 1;
        
        console.log(`🗑️ Database cleared - ${userCount} users deleted`);
        
        res.json({ 
            success: true, 
            message: `Database cleared - ${userCount} users deleted` 
        });
    } catch (error) {
        console.error('Error clearing database:', error);
        res.status(500).json({ error: 'Failed to clear database' });
    }
});

// Get analytics data
app.get('/api/admin/analytics', basicAuth, (req, res) => {
    try {
        // Registration timeline (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const registrationTimeline = {};
        users.forEach(user => {
            const date = new Date(user.created_at).toDateString();
            registrationTimeline[date] = (registrationTimeline[date] || 0) + 1;
        });

        // College distribution
        const collegeDistribution = {};
        users.forEach(user => {
            collegeDistribution[user.college_name] = (collegeDistribution[user.college_name] || 0) + 1;
        });

        // Priority distribution
        const priorityDistribution = {
            high: users.filter(u => u.priority_score >= 20).length,
            medium: users.filter(u => u.priority_score >= 10 && u.priority_score < 20).length,
            low: users.filter(u => u.priority_score < 10).length
        };

        // Referral stats
        const referralStats = {
            total_referrals: users.filter(u => u.referred_by).length,
            active_referrers: users.filter(u => u.referral_count > 0).length,
            top_referrers: users
                .filter(u => u.referral_count > 0)
                .sort((a, b) => b.referral_count - a.referral_count)
                .slice(0, 10)
                .map(u => ({
                    email: u.email,
                    referral_count: u.referral_count,
                    college: u.college_name
                }))
        };

        res.json({
            registration_timeline: registrationTimeline,
            college_distribution: collegeDistribution,
            priority_distribution: priorityDistribution,
            referral_stats: referralStats
        });
    } catch (error) {
        console.error('Error getting analytics:', error);
        res.status(500).json({ error: 'Failed to get analytics' });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('💥 Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
});

// Start server
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const interface of interfaces[name]) {
            if (interface.family === 'IPv4' && !interface.internal) {
                return interface.address;
            }
        }
    }
    return 'localhost';
}

app.listen(PORT, '0.0.0.0', () => {
    const localIP = getLocalIP();
    console.log(`🔮 MystiQ server running on port ${PORT}`);
    console.log(`📱 Local: http://localhost:${PORT}`);
    console.log(`🌐 Network: http://${localIP}:${PORT}`);
    console.log(`🧪 Test form: http://${localIP}:${PORT}/test.html`);
    console.log(`👨‍💼 Admin: http://${localIP}:${PORT}/admin.html`);
    console.log(`❤️ Health: http://${localIP}:${PORT}/api/health`);
    console.log(`🔐 Admin credentials: admin / mystiq123`);
    
    // Start self-ping only in production environments
    const isProduction = process.env.NODE_ENV === 'production' || 
                         process.env.RAILWAY_STATIC_URL || 
                         process.env.RENDER_EXTERNAL_URL || 
                         process.env.HEROKU_APP_NAME ||
                         process.env.VERCEL_URL;
    
    if (isProduction) {
        console.log('🚀 Production environment detected - starting keep-alive system');
        startSelfPing();
    } else {
        console.log('🛠️ Development environment - keep-alive disabled');
    }
});

// ===== GRACEFUL SHUTDOWN HANDLERS =====

process.on('SIGTERM', () => {
    console.log('🛑 Received SIGTERM, shutting down gracefully');
    stopSelfPing();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🛑 Received SIGINT, shutting down gracefully');
    stopSelfPing();
    process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error);
    stopSelfPing();
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    stopSelfPing();
    process.exit(1);
});

module.exports = app;
