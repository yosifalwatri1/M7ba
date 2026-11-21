'use strict';
// دالة Vercel: كل طلبات /api/* تصل هنا (انظر vercel.json)
const { handle } = require('../lib/app');

module.exports = (req, res) => handle(req, res);
