class MystiQ {
    constructor() {
        this.init();
        this.setupEventListeners();
        this.setupScrollAnimations();
        this.startTypingAnimation();
    }

    init() {
        this.isRegistrationVisible = false;
        this.isTeaserUnlocked = false;
        this.typingTexts = [
            "A place where identities don't matter.",
            "Until you choose."
        ];
        this.currentTextIndex = 0;
    }

    setupEventListeners() {
        // CTA Button
        var ctaButton = document.getElementById('ctaButton');
        if (ctaButton) {
            ctaButton.addEventListener('click', () => {
                this.scrollToSection('teaserSection');
            });
        }

        // Unlock teaser button
        var unlockButton = document.getElementById('unlockButton');
        if (unlockButton) {
            unlockButton.addEventListener('click', () => {
                this.unlockTeaser();
            });
        }

        // Registration form
        var registrationForm = document.getElementById('registrationForm');
        if (registrationForm) {
            registrationForm.addEventListener('submit', (e) => {
                this.handleRegistration(e);
            });
        }

        // Copy referral code
        var copyButton = document.getElementById('copyCodeButton');
        if (copyButton) {
            copyButton.addEventListener('click', () => {
                this.copyReferralCode();
            });
        }

        // URL parameters check for referral
        this.checkReferralCode();
    }

    setupScrollAnimations() {
        var observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        var observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    
                    // Special handling for curiosity section
                    if (entry.target.id === 'curiositySection') {
                        setTimeout(() => {
                            var revealText = document.getElementById('revealText');
                            if (revealText) {
                                revealText.classList.add('visible');
                            }
                        }, 1000);
                    }
                }
            });
        }, observerOptions);

        // Observe sections
        var sections = document.querySelectorAll('.curiosity, .how-it-works, .exclusivity, .teaser');
        sections.forEach(section => {
            observer.observe(section);
        });
    }

    startTypingAnimation() {
        var typingElement = document.getElementById('typingText');
        if (!typingElement) return;

        var currentText = '';
        var isDeleting = false;
        var textIndex = 0;
        var charIndex = 0;

        var typeText = () => {
            var fullText = this.typingTexts[textIndex];
            
            if (isDeleting) {
                currentText = fullText.substring(0, charIndex - 1);
                charIndex--;
            } else {
                currentText = fullText.substring(0, charIndex + 1);
                charIndex++;
            }

            typingElement.textContent = currentText;

            var typeSpeed = isDeleting ? 50 : 100
                        if (!isDeleting && charIndex === fullText.length) {
                typeSpeed = 2000; // Pause at end
                isDeleting = true;
            } else if (isDeleting && charIndex === 0) {
                isDeleting = false;
                textIndex = (textIndex + 1) % this.typingTexts.length;
                typeSpeed = 500; // Pause before next text
            }

            setTimeout(typeText, typeSpeed);
        };

        typeText();
    }

    scrollToSection(sectionId) {
        var section = document.getElementById(sectionId);
        if (section) {
            section.scrollIntoView({ 
                behavior: 'smooth',
                block: 'center'
            });
        }
    }

    unlockTeaser() {
        var questionCard = document.getElementById('questionCard');
        var registrationSection = document.getElementById('registrationSection');
        var teaserAnswerGroup = document.getElementById('teaserAnswerGroup');
        
        // Unlock the question
        if (questionCard) {
            questionCard.classList.add('unlocked');
        }
        this.isTeaserUnlocked = true;
        
        // Show registration form
        setTimeout(() => {
            if (registrationSection) {
                registrationSection.style.display = 'block';
                registrationSection.classList.add('visible');
            }
            if (teaserAnswerGroup) {
                teaserAnswerGroup.style.display = 'block';
                teaserAnswerGroup.classList.add('visible');
            }
            this.scrollToSection('registrationSection');
        }, 500);
    }

    async handleRegistration(e) {
        e.preventDefault();
        
        var submitButton = document.getElementById('submitButton');
        var originalText = submitButton.innerHTML;
        
        // Show loading state
        submitButton.innerHTML = '<span>Reserving...</span>';
        submitButton.disabled = true;
        submitButton.classList.add('loading');

        // Clear previous errors
        this.clearErrors();

        // Get form data
        var formData = {
            email: document.getElementById('email').value.trim(),
            college_name: document.getElementById('collegeName').value.trim(),
            age: document.getElementById('age').value,
            city: document.getElementById('city').value.trim(),
            instagram: document.getElementById('instagram').value.trim(),
            teaser_answer: this.isTeaserUnlocked ? document.getElementById('teaserAnswer').value.trim() : null,
            referred_by: document.getElementById('referralCode').value.trim()
        };

        // Validate form
        if (!this.validateForm(formData)) {
            submitButton.innerHTML = originalText;
            submitButton.disabled = false;
            submitButton.classList.remove('loading');
            return;
        }

        try {
            var response = await fetch('/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });

            var result = await response.json();

            if (response.ok) {
                this.showSuccess(result);
            } else {
                this.showError(result.error || 'Registration failed');
            }
        } catch (error) {
            console.error('Registration error:', error);
            this.showError('Network error. Please try again.');
        } finally {
            submitButton.innerHTML = originalText;
            submitButton.disabled = false;
            submitButton.classList.remove('loading');
        }
    }

    validateForm(formData) {
        var isValid = true;

        // Email validation
        var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        var collegeEmailRegex = /\.(edu|ac\.|edu\.)/;
        
        if (!emailRegex.test(formData.email)) {
            this.showFieldError('email', 'Please enter a valid email address');
            isValid = false;
        } else if (!collegeEmailRegex.test(formData.email)) {
            this.showFieldError('email', 'Please use your college email address');
            isValid = false;
        }

        // Age validation
        if (!formData.age || formData.age < 18) {
            this.showFieldError('age', 'You must be 18 or older');
            isValid = false;
        }

        // Required fields
        var requiredFields = ['college_name', 'city'];
        requiredFields.forEach(field => {
            if (!formData[field]) {
                this.showFieldError(field.replace('_', 'Name'), 'This field is required');
                isValid = false;
            }
        });

        // Checkboxes
        if (!document.getElementById('ageConfirm').checked) {
            this.showFieldError('ageConfirm', 'Please confirm you are 18 or older');
            isValid = false;
        }

        if (!document.getElementById('notifications').checked) {
            this.showFieldError('notifications', 'Please agree to notifications');
            isValid = false;
        }

        return isValid;
    }

    showFieldError(fieldId, message) {
        var field = document.getElementById(fieldId);
        if (field) {
            field.classList.add('error');
            
            // Create or update error message
            var errorElement = field.parentNode.querySelector('.error-message');
            if (!errorElement) {
                errorElement = document.createElement('div');
                errorElement.className = 'error-message';
                field.parentNode.appendChild(errorElement);
            }
            
            errorElement.textContent = message;
            errorElement.classList.add('visible');
        }
    }

    clearErrors() {
        var errorFields = document.querySelectorAll('.error');
        var errorMessages = document.querySelectorAll('.error-message');
        
        errorFields.forEach(field => field.classList.remove('error'));
        errorMessages.forEach(msg => {
            msg.classList.remove('visible');
            setTimeout(() => {
                if (msg.parentNode) {
                    msg.parentNode.removeChild(msg);
                }
            }, 300);
        });
    }

    showError(message) {
        // Create temporary error display
        var errorDiv = document.createElement('div');
        errorDiv.className = 'error-notification';
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #ef4444;
            color: white;
            padding: 15px 25px;
            border-radius: 10px;
            z-index: 1000;
            box-shadow: 0 10px 30px rgba(239, 68, 68, 0.3);
            font-family: 'Inter', sans-serif;
            font-size: 0.9rem;
            max-width: 90%;
            text-align: center;
        `;
        errorDiv.textContent = message;
        
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 5000);
    }

    showSuccess(data) {
        // Hide registration form
        var registrationSection = document.getElementById('registrationSection');
        if (registrationSection) {
            registrationSection.style.display = 'none';
        }
        
        // Show success section
        var successSection = document.getElementById('successSection');
        if (successSection) {
            successSection.style.display = 'block';
            successSection.classList.add('visible');
        }
        
        // Update success data
        var queuePosition = document.getElementById('queuePosition');
        var totalUsers = document.getElementById('totalUsers');
        var userReferralCode = document.getElementById('userReferralCode');
        var referralCount = document.getElementById('referralCount');
        
        if (queuePosition) queuePosition.textContent = `#${data.queuePosition}`;
        if (totalUsers) totalUsers.textContent = data.totalUsers;
        if (userReferralCode) userReferralCode.textContent = data.referralCode;
        if (referralCount) referralCount.textContent = '0';
        
        // Scroll to success section
        setTimeout(() => {
            this.scrollToSection('successSection');
        }, 100);
        
        // Store referral code for sharing
        this.userReferralCode = data.referralCode;
    }

    copyReferralCode() {
        var referralCodeElement = document.getElementById('userReferralCode');
        if (!referralCodeElement) return;
        
        var referralCode = referralCodeElement.textContent;
        var shareText = `Join me on MystiQ - the anonymous chat app for college students! Use my code: ${referralCode}\n\n${window.location.origin}?ref=${referralCode}`;
        
        if (navigator.share) {
            navigator.share({
                title: 'Join MystiQ',
                text: shareText
            });
        } else if (navigator.clipboard) {
            navigator.clipboard.writeText(shareText).then(() => {
                this.showCopySuccess();
            });
        } else {
            // Fallback for older browsers
            var textArea = document.createElement('textarea');
            textArea.value = shareText;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.showCopySuccess();
        }
    }

    showCopySuccess() {
        var button = document.getElementById('copyCodeButton');
        if (!button) return;
        
        var originalText = button.textContent;
        var originalBackground = button.style.background;
        
        button.textContent = 'Copied!';
        button.style.background = '#10b981';
        
        setTimeout(() => {
            button.textContent = originalText;
            button.style.background = originalBackground || '#a855f7';
        }, 2000);
    }

    checkReferralCode() {
        var urlParams = new URLSearchParams(window.location.search);
        var refCode = urlParams.get('ref');
        
        if (refCode) {
            var referralCodeInput = document.getElementById('referralCode');
            if (referralCodeInput) {
                referralCodeInput.value = refCode;
            }
            
            // Show a welcome message for referred users
            this.showReferralWelcome();
        }
    }

    showReferralWelcome() {
        var welcomeDiv = document.createElement('div');
        welcomeDiv.className = 'referral-welcome';
        welcomeDiv.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, #8b5cf6, #a855f7);
            color: white;
            padding: 15px 25px;
            border-radius: 10px;
            z-index: 1000;
            box-shadow: 0 10px 30px rgba(168, 85, 247, 0.3);
            font-family: 'Inter', sans-serif;
            text-align: center;
            line-height: 1.4;
            max-width: 90%;
        `;
        welcomeDiv.innerHTML = `
            <strong style="font-size: 1rem;">🎉 You've been invited!</strong><br>
            <small style="font-size: 0.85rem; opacity: 0.9;">You'll get priority access to MystiQ</small>
        `;
        
        document.body.appendChild(welcomeDiv);
        
        setTimeout(() => {
            if (welcomeDiv.parentNode) {
                welcomeDiv.style.opacity = '0';
                welcomeDiv.style.transform = 'translate(-50%, -100%)';
                welcomeDiv.style.transition = 'all 0.5s ease';
                setTimeout(() => {
                    if (welcomeDiv.parentNode) {
                        welcomeDiv.parentNode.removeChild(welcomeDiv);
                    }
                }, 500);
            }
        }, 4000);
    }

    // Admin functions (for development/testing)
    async getQueueStatus(email) {
        try {
            var response = await fetch(`/api/queue/${encodeURIComponent(email)}`);
            var data = await response.json();
            
            if (response.ok) {
                console.log('Queue Status:', data);
                return data;
            } else {
                console.error('Error getting queue status:', data.error);
            }
        } catch (error) {
            console.error('Network error:', error);
        }
    }

    // Easter egg - Konami code
    setupKonamiCode() {
        var konamiCode = [
            'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
            'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
            'KeyB', 'KeyA'
        ];
        var konamiIndex = 0;

        document.addEventListener('keydown', (e) => {
            if (e.code === konamiCode[konamiIndex]) {
                konamiIndex++;
                if (konamiIndex === konamiCode.length) {
                    this.activateEasterEgg();
                    konamiIndex = 0;
                }
            } else {
                konamiIndex = 0;
            }
        });
    }

    activateEasterEgg() {
        // Add some fun effects
        document.body.style.animation = 'rainbow 2s infinite';
        
        var style = document.createElement('style');
        style.textContent = `
            @keyframes rainbow {
                0% { filter: hue-rotate(0deg); }
                100% { filter: hue-rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
        
        setTimeout(() => {
            document.body.style.animation = '';
            if (style.parentNode) {
                style.parentNode.removeChild(style);
            }
        }, 10000);
        
        // Show secret message
        var secretDiv = document.createElement('div');
        secretDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.9);
            color: #a855f7;
            padding: 30px;
            border-radius: 20px;
            text-align: center;
            z-index: 10000;
            border: 2px solid #a855f7;
            box-shadow: 0 0 50px rgba(168, 85, 247, 0.5);
            font-family: 'Inter', sans-serif;
        `;
        secretDiv.innerHTML = `
            <h3 style="margin-bottom: 10px;">🎮 Secret Unlocked!</h3>
            <p style="margin-bottom: 10px;">You found the hidden code!</p>
            <p><small>Priority access granted 🚀</small></p>
        `;
        
        document.body.appendChild(secretDiv);
        
        setTimeout(() => {
            if (secretDiv.parentNode) {
                secretDiv.parentNode.removeChild(secretDiv);
            }
        }, 5000);
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    var app = new MystiQ();
    
    // Setup Konami code easter egg
    app.setupKonamiCode();
    
    // Make app globally accessible for debugging
    window.MystiQApp = app

        
    // Add some development helpers
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.log('🔮 MystiQ Development Mode');
        console.log('Available commands:');
        console.log('- MystiQApp.getQueueStatus("email@college.edu")');
        console.log('- Try the Konami code: ↑↑↓↓←→←→BA');
        console.log('- fillTestData() - Auto-fill the form with test data');
        
        // Auto-fill form in development
        window.fillTestData = function() {
            var emailField = document.getElementById('email');
            var collegeField = document.getElementById('collegeName');
            var ageField = document.getElementById('age');
            var cityField = document.getElementById('city');
            var instagramField = document.getElementById('instagram');
            var ageConfirm = document.getElementById('ageConfirm');
            var notifications = document.getElementById('notifications');
            var teaserAnswer = document.getElementById('teaserAnswer');
            
            if (emailField) emailField.value = 'test@stanford.edu';
            if (collegeField) collegeField.value = 'Stanford University';
            if (ageField) ageField.value = '20';
            if (cityField) cityField.value = 'Palo Alto';
            if (instagramField) instagramField.value = 'test_user';
            if (ageConfirm) ageConfirm.checked = true;
            if (notifications) notifications.checked = true;
            
            if (app.isTeaserUnlocked && teaserAnswer) {
                teaserAnswer.value = 'I sometimes feel like I\'m just pretending to have it all figured out.';
            }
            
            console.log('✅ Test data filled!');
        };
        
        // Quick unlock teaser for testing
        window.unlockTeaser = function() {
            app.unlockTeaser();
            console.log('✅ Teaser unlocked!');
        };
    }
});

// Service Worker registration for PWA capabilities (optional)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/sw.js')
            .then(function(registration) {
                console.log('SW registered: ', registration);
            })
            .catch(function(registrationError) {
                console.log('SW registration failed: ', registrationError);
            });
    });
}

// Handle online/offline status
window.addEventListener('online', function() {
    console.log('Back online');
    // Show a subtle notification
    var onlineDiv = document.createElement('div');
    onlineDiv.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 10px 20px;
        border-radius: 5px;
        z-index: 1000;
        font-family: 'Inter', sans-serif;
        font-size: 0.9rem;
    `;
    onlineDiv.textContent = '🟢 Back online';
    document.body.appendChild(onlineDiv);
    
    setTimeout(() => {
        if (onlineDiv.parentNode) {
            onlineDiv.parentNode.removeChild(onlineDiv);
        }
    }, 3000);
});

window.addEventListener('offline', function() {
    console.log('Gone offline');
    // Show offline notification
    var offlineDiv = document.createElement('div');
    offlineDiv.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #ef4444;
        color: white;
        padding: 10px 20px;
        border-radius: 5px;
        z-index: 1000;
        font-family: 'Inter', sans-serif;
        font-size: 0.9rem;
    `;
    offlineDiv.textContent = '🔴 Connection lost';
    document.body.appendChild(offlineDiv);
    
    setTimeout(() => {
        if (offlineDiv.parentNode) {
            offlineDiv.parentNode.removeChild(offlineDiv);
        }
    }, 5000);
});

// Prevent right-click context menu for a more app-like feel
document.addEventListener('contextmenu', function(e) {
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        e.preventDefault();
    }
});

// Disable text selection on certain elements
document.addEventListener('selectstart', function(e) {
    if (e.target.classList.contains('no-select')) {
        e.preventDefault();
    }
});

// Add smooth scrolling polyfill for older browsers
if (!('scrollBehavior' in document.documentElement.style)) {
    var script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/gh/iamdustan/smoothscroll@master/src/smoothscroll.js';
    document.head.appendChild(script);
}

// Prevent form submission on Enter key in input fields (except submit button)
document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'submit') {
        e.preventDefault();
        // Move to next input field
        var inputs = Array.from(document.querySelectorAll('input, textarea, button'));
        var currentIndex = inputs.indexOf(e.target);
        var nextInput = inputs[currentIndex + 1];
        if (nextInput) {
            nextInput.focus();
        }
    }
});

// Add loading state to page
window.addEventListener('beforeunload', function() {
    document.body.style.opacity = '0.7';
    document.body.style.pointerEvents = 'none';
});

// Remove loading state when page loads
window.addEventListener('load', function() {
    document.body.style.opacity = '1';
    document.body.style.pointerEvents = 'auto';
});