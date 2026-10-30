const jsonwebtoken = require("jsonwebtoken");
const { CONFIG } = require("../config");

const getIssuer = () => CONFIG.FRONTEND_DOMAIN_COOKIE || "restropro-saas";

exports.generateAccessToken = (payload) => {
    const token = jsonwebtoken.sign(payload, CONFIG.JWT_SECRET, {
        expiresIn: CONFIG.JWT_EXPIRY,
        issuer: getIssuer()
    });
    return token;
};

exports.generateRefreshToken = (payload) => {
    const token = jsonwebtoken.sign(payload, CONFIG.JWT_SECRET, {
        expiresIn: CONFIG.JWT_EXPIRY_REFRESH,
        issuer: getIssuer()
    });
    return token;
};

exports.verifyToken = (token) => {
    const decodedToken = jsonwebtoken.verify(token, CONFIG.JWT_SECRET, {issuer: getIssuer()});
    return decodedToken;
};
