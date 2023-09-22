const path = require('path');
const invitationAttachments = [
    {
        filename: 'fb.png',
        path: path.join(
            __dirname,
            '..',
            'templates',
            'images',
            'fb.png'
        ),
        cid: 'fb.png@invitationAttachment'
    },
    {
        filename: 'insta.png',
        path: path.join(
            __dirname,
            '..',
            'templates',
            'images',
            'insta.png'
        ),
        cid: 'insta.png@invitationAttachment'
    },
    {
        filename: 'linkedin.png',
        path: path.join(
            __dirname,
            '..',
            'templates',
            'images',
            'linkedin.png'
        ),
        cid: 'linkedin.png@invitationAttachment'
    },
    {
        filename: 'logo.png',
        path: path.join(
            __dirname,
            '..',
            'templates',
            'images',
            'logo.png'
        ),
        cid: 'logo.png@invitationAttachment'
    },
    {
        filename: 'redit.png',
        path: path.join(
            __dirname,
            '..',
            'templates',
            'images',
            'redit.png'
        ),
        cid: 'redit.png@invitationAttachment'
    },
    {
        filename: 'telegram.png',
        path: path.join(
            __dirname,
            '..',
            'templates',
            'images',
            'telegram.png'
        ),
        cid: 'telegram.png@invitationAttachment'
    },
    {
        filename: 'twitter.png',
        path: path.join(
            __dirname,
            '..',
            'templates',
            'images',
            'twitter.png'
        ),
        cid: 'twitter.png@invitationAttachment'
    },
    {
        filename: 'welcome-img.png',
        path: path.join(
            __dirname,
            '..',
            'templates',
            'images',
            'welcome-img.png'
        ),
        cid: 'welcome-img.png@invitationAttachment'
    },
]
const verifyOTPAttachment = [
    {
        filename: 'fb.png',
        path: path.join(
            __dirname,
            '..',
            'templates',
            'images',
            'fb.png'
        ),
        cid: 'fb.png@verifyOTPAttachtment'
    },
    {
        filename: 'insta.png',
        path: path.join(
            __dirname,
            '..',
            'templates',
            'images',
            'insta.png'
        ),
        cid: 'insta.png@verifyOTPAttachtment'
    },
    {
        filename: 'linkedin.png',
        path: path.join(
            __dirname,
            '..',
            'templates',
            'images',
            'linkedin.png'
        ),
        cid: 'linkedin.png@verifyOTPAttachtment'
    },
    {
        filename: 'logo.png',
        path: path.join(
            __dirname,
            '..',
            'templates',
            'images',
            'logo.png'
        ),
        cid: 'logo.png@verifyOTPAttachtment'
    },
    {
        filename: 'redit.png',
        path: path.join(
            __dirname,
            '..',
            'templates',
            'images',
            'redit.png'
        ),
        cid: 'redit.png@verifyOTPAttachtment'
    },
    {
        filename: 'telegram.png',
        path: path.join(
            __dirname,
            '..',
            'templates',
            'images',
            'telegram.png'
        ),
        cid: 'telegram.png@verifyOTPAttachtment'
    },
    {
        filename: 'twitter.png',
        path: path.join(
            __dirname,
            '..',
            'templates',
            'images',
            'twitter.png'
        ),
        cid: 'twitter.png@verifyOTPAttachtment'
    },
    {
        filename: 'welcome-img.png',
        path: path.join(
            __dirname,
            '..',
            'templates',
            'images',
            'welcome-img.png'
        ),
        cid: 'welcome-img.png@verifyOTPAttachtment'
    },
]

const mailAttachment = [
//   {
//     filename: "fb.png",
//     path: path.join(__dirname, "..", "templates", "images", "fb.png"),
//     cid: "fb.png@mailAttachment",
//   },
//   {
//     filename: "insta.png",
//     path: path.join(__dirname, "..", "templates", "images", "insta.png"),
//     cid: "insta.png@mailAttachment",
//   },
//   {
//     filename: "linkedin.png",
//     path: path.join(__dirname, "..", "templates", "images", "linkedin.png"),
//     cid: "linkedin.png@mailAttachment",
//   },
  {
    filename: "logo.png",
    path: path.join(__dirname, "..", "templates", "images", "logo.png"),
    cid: "logo.png@mailAttachment",
  },
//   {
//     filename: "redit.png",
//     path: path.join(__dirname, "..", "templates", "images", "redit.png"),
//     cid: "redit.png@mailAttachment",
//   },
//   {
//     filename: "telegram.png",
//     path: path.join(__dirname, "..", "templates", "images", "telegram.png"),
//     cid: "telegram.png@mailAttachment",
//   },
//   {
//     filename: "twitter.png",
//     path: path.join(__dirname, "..", "templates", "images", "twitter.png"),
//     cid: "twitter.png@mailAttachment",
//   },
  {
    filename: "welcome-img.png",
    path: path.join(__dirname, "..", "templates", "images", "welcome-img.png"),
    cid: "welcome-img.png@mailAttachment",
  },
];

module.exports = {
     verifyOTPAttachment,
     invitationAttachments,
     mailAttachment
}