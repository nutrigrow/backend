const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const prisma = require('./database');

/**
 * Configure Google OAuth 2.0 Strategy for Passport.js
 *
 * Flow:
 * 1. User clicks "Login with Google"
 * 2. Redirect to Google consent screen
 * 3. Google redirects back with profile data
 * 4. We find or create the user in our database
 */
passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: process.env.GOOGLE_CALLBACK_URL,
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                const email = profile.emails?.[0]?.value;
                if (!email) {
                    return done(new Error('Email tidak ditemukan dari akun Google'), null);
                }

                // Check if user already exists (by googleId or email)
                let user = await prisma.user.findFirst({
                    where: {
                        OR: [
                            { googleId: profile.id },
                            { email },
                        ],
                    },
                });

                if (user) {
                    // Link Google account if user registered with email/password before
                    if (!user.googleId) {
                        user = await prisma.user.update({
                            where: { id: user.id },
                            data: {
                                googleId: profile.id,
                                avatarUrl: user.avatarUrl || profile.photos?.[0]?.value,
                                emailVerifiedAt: user.emailVerifiedAt || new Date(),
                            },
                        });
                    }
                } else {
                    // Create new user from Google profile
                    user = await prisma.user.create({
                        data: {
                            nama: profile.displayName,
                            email,
                            googleId: profile.id,
                            avatarUrl: profile.photos?.[0]?.value,
                            emailVerifiedAt: new Date(), // Google emails are verified
                        },
                    });
                }

                return done(null, user);
            } catch (error) {
                return done(error, null);
            }
        }
    )
);

// We use JWT (stateless), so no need for serialize/deserialize sessions
// But Passport requires these to be defined
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
    try {
        const user = await prisma.user.findUnique({ where: { id } });
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});

module.exports = passport;
