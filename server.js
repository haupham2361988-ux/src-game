// Bọc try-catch cho dotenv: Nếu không có file .env, server vẫn sống và tự nhận biến của Render
try {
    require('dotenv').config();
} catch (error) {}

const cors = require('cors');
const Telegram = require('node-telegram-bot-api');
const express = require('express');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const mongoose = require('mongoose');

// Token Telegram (Giữ nguyên token đang dùng, đã xóa các token nháp)
const TelegramToken = '1359141283:AAEMQ-iws4XdsG0XiajuaCmBjkNKOTkfV_I';
const TelegramBot = new Telegram(TelegramToken, { polling: true });

const app = express();

// Cấu hình CORS để không bị block kết nối WebSocket/API trên web
app.use(cors({
    origin: '*',
    optionsSuccessStatus: 200
}));

// Cấu hình Port chuẩn cho Render (Render sẽ cấp port vào process.env.PORT, nếu không có tự chạy 10000)
const port = process.env.PORT || 10000;

// Khởi tạo WebSocket bọc chung với Express (Cực chuẩn để chạy WSS tự động trên Render)
const expressWs = require('express-ws')(app);
const redT = expressWs.getWss();

// Cấu hình Database Mongoose (Giữ nguyên thư viện Mongoose Long 2020)
const configDB = require('./config/database');
require('mongoose-long')(mongoose); // INT 64bit

mongoose.set('useFindAndModify', false);
mongoose.set('useCreateIndex', true);

// FIX LỖI LOGIC CŨ: Code cũ của bạn dùng .catch để check cả success là sai nguyên lý Promise. 
// Đã sửa lại chuẩn để log chính xác trạng thái kết nối DB.
mongoose.connect(configDB.url, configDB.options)
    .then(() => {
        console.log('Connect to MongoDB success');
    })
    .catch((error) => {
        console.log('Connect to MongoDB failed:', error.message);
    });

// Kết nối Admin mặc định
require('./config/admin');

// Cấu hình App & đọc dữ liệu form
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(morgan('combined')); // Log requests

app.set('view engine', 'ejs'); // Chỉ định view engine là ejs
app.set('views', './views'); // Chỉ định thư mục view

// Serve thư mục tĩnh (chứa HTML, CSS, JS của frontend)
app.use(express.static('public'));

// Biến toàn cục cho Logic Game (Giữ nguyên 100%)
redT.telegram = TelegramBot;
global['redT'] = redT;
global['userOnline'] = 0;

// Load các logic Game, Socket, Router HTTP (Giữ nguyên 100% logic cũ)
require('./app/Helpers/socketUser')(redT); // Add function socket
require('./routerHttp')(app, redT); // load các routes HTTP
require('./routerHTTPV1')(app, redT); // load routes news
require('./routerSocket')(app, redT); // load các routes WebSocket

// Chạy Cron Job Game
require('./app/Cron/taixiu')(redT); // Chạy game Tài Xỉu
require('./app/Cron/baucua')(redT); // Chạy game Bầu Cua
require('./config/Cron')();
require('./update')();

// Telegram Bot
require('./app/Telegram/Telegram')(TelegramBot); 

// Lắng nghe Port (Render sẽ map port này ra WSS)
app.listen(port, () => {
    console.log("Server listen on port", port);
});