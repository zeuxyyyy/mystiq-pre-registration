const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
    constructor() {
        this.db = new sqlite3.Database('mystiq.db', (err) => {
            if (err) {
                console.error('Error opening database:', err);
            } else {
                console.log('✅ Connected to SQLite database');
                this.init();
            }
        });
    }

    init() {
        const createUsersTable = `
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                college_name TEXT NOT NULL,
                age INTEGER NOT NULL,
                city TEXT NOT NULL,
                instagram TEXT,
                teaser_answer TEXT,
                referral_code TEXT UNIQUE,
                referred_by TEXT,
                referral_count INTEGER DEFAULT 0,
                priority_score INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                status TEXT DEFAULT 'pending'
            )
        `;

        const createReferralsTable = `
            CREATE TABLE IF NOT EXISTS referrals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                referrer_email TEXT NOT NULL,
                referred_email TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (referrer_email) REFERENCES users (email),
                FOREIGN KEY (referred_email) REFERENCES users (email)
            )
        `;

        this.db.run(createUsersTable, (err) => {
            if (err) {
                console.error('Error creating users table:', err);
            } else {
                console.log('✅ Users table ready');
            }
        });

        this.db.run(createReferralsTable, (err) => {
            if (err) {
                console.error('Error creating referrals table:', err);
            } else {
                console.log('✅ Referrals table ready');
            }
        });
    }

    generateReferralCode() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    async registerUser(userData) {
        return new Promise((resolve, reject) => {
            const referralCode = this.generateReferralCode();
            let priorityScore = 0;

            // Calculate priority score
            if (userData.teaser_answer && userData.teaser_answer.length > 20) priorityScore += 10;
            if (userData.instagram) priorityScore += 5;
            if (userData.referred_by) priorityScore += 15;

            const query = `
                INSERT INTO users (email, college_name, age, city, instagram, teaser_answer, referral_code, referred_by, priority_score)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            // Store reference to this.db to avoid context issues
            const db = this.db;

            db.run(query, [
                userData.email,
                userData.college_name,
                userData.age,
                userData.city,
                userData.instagram || null,
                userData.teaser_answer || null,
                referralCode,
                userData.referred_by || null,
                priorityScore
            ], function(err) {
                if (err) {
                    console.error('Error inserting user:', err);
                    reject(err);
                } else {
                    console.log('✅ User inserted with ID:', this.lastID);
                    
                    // Update referrer's count if applicable
                    if (userData.referred_by) {
                        const updateReferrer = `
                            UPDATE users 
                            SET referral_count = referral_count + 1,
                                priority_score = priority_score + 20
                            WHERE referral_code = ?
                        `;
                        
                        db.run(updateReferrer, [userData.referred_by], (updateErr) => {
                            if (updateErr) {
                                console.error('Error updating referrer:', updateErr);
                            } else {
                                console.log('✅ Referrer updated');
                            }
                        });
                        
                        // Add to referrals table
                        const addReferral = `
                            INSERT INTO referrals (referrer_email, referred_email)
                            SELECT u1.email, u2.email 
                            FROM users u1, users u2 
                            WHERE u1.referral_code = ? AND u2.email = ?
                        `;
                        
                        db.run(addReferral, [userData.referred_by, userData.email], (refErr) => {
                            if (refErr) {
                                console.error('Error adding referral:', refErr);
                            } else {
                                console.log('✅ Referral recorded');
                            }
                        });
                    }
                    
                    resolve({ 
                        id: this.lastID, 
                        referralCode: referralCode,
                        priorityScore: priorityScore
                    });
                }
            });
        });
    }

    async getUserByEmail(email) {
        return new Promise((resolve, reject) => {
            const query = `SELECT * FROM users WHERE email = ?`;
            this.db.get(query, [email], (err, row) => {
                if (err) {
                    console.error('Error getting user:', err);
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async getQueuePosition(email) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT COUNT(*) as position 
                FROM users 
                WHERE priority_score > (
                    SELECT priority_score FROM users WHERE email = ?
                ) OR (
                    priority_score = (SELECT priority_score FROM users WHERE email = ?) 
                    AND created_at < (SELECT created_at FROM users WHERE email = ?)
                )
            `;
            
            this.db.get(query, [email, email, email], (err, row) => {
                if (err) {
                    console.error('Error getting queue position:', err);
                    reject(err);
                } else {
                    resolve(row.position + 1);
                }
            });
        });
    }

    async getTotalUsers() {
        return new Promise((resolve, reject) => {
            const query = `SELECT COUNT(*) as total FROM users`;
            this.db.get(query, [], (err, row) => {
                if (err) {
                    console.error('Error getting total users:', err);
                    reject(err);
                } else {
                    resolve(row.total);
                }
            });
        });
    }

    // Close database connection
    close() {
        return new Promise((resolve, reject) => {
            this.db.close((err) => {
                if (err) {
                    console.error('Error closing database:', err);
                    reject(err);
                } else {
                    console.log('✅ Database connection closed');
                    resolve();
                }
            });
        });
    }
}

module.exports = Database;