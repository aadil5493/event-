const express = require('express');
const nodemailer = require('nodemailer');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// Serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Multer setup for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (['image/jpeg', 'image/png'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG or PNG files allowed'), false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

// Email route
app.post('/send-email', upload.single('payment'), async (req, res) => {
  const { name, mobile, city, business, passId } = req.body;
  const payment = req.file;

  if (!name || !mobile || !/^\d{10}$/.test(mobile) || !city || !business || !payment || !passId) {
    return res.status(400).json({ message: 'Missing or invalid fields.' });
  }

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // Email to admin
    await transporter.sendMail({
      from: `"Canton Fair Seminar" <${process.env.EMAIL_USER}>`,
      to: 'Adinathoverseasrjt@gmail.com',
      subject: `New Registration: Canton Fair Seminar - ${name}`,
      html: `
        <h2>New Registration Details</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Mobile:</strong> ${mobile}</p>
        <p><strong>City:</strong> ${city}</p>
        <p><strong>Business Type:</strong> ${business}</p>
        <p><strong>Pass ID:</strong> ${passId}</p>
        <p>Please find the payment screenshot attached below.</p>
        <p>Event Details:</p>
        <ul>
          <li>Date: 20 July 2025</li>
          <li>Time: 5 PM Onward</li>
          <li>Location: S.G Highway, Ahmedabad</li>
        </ul>
      `,
      attachments: [
        {
          filename: payment.originalname,
          content: payment.buffer,
          contentType: payment.mimetype,
        },
      ],
    });

    res.status(200).json({ message: 'Email sent successfully to admin' });
  } catch (err) {
    console.error('❌ Email send error:', err);
    res.status(500).json({ message: 'Failed to send email to admin', error: err.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server is running at http://localhost:${PORT}`);
});