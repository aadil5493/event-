const express = require('express');
const nodemailer = require('nodemailer');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// Serve homepage
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// File upload config
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
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Setup transporter with timeouts and port 587 (more reliable)
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  requireTLS: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 10000,
});

// Email route
app.post('/send-email', upload.single('payment'), async (req, res) => {
  const { name, email, mobile, city, business } = req.body;
  const payment = req.file;

  if (!name || !email || !mobile || !/^\d{10}$/.test(mobile) || !city || !business || !payment) {
    return res.status(400).json({ message: 'Missing or invalid fields.' });
  }

  const adminEmail = 'Adinathoverseasrjt@gmail.com';

  try {
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; background: #f9f9f9; padding: 20px; border-radius: 10px; max-width: 600px; margin: auto;">
        <h2 style="color: #007bff;">🎉 Registration Confirmed!</h2>
        <p>Hello <strong>${name}</strong>,</p>
        <p>Thank you for registering for the <strong>Canton Fair Seminar</strong>. Below are your details:</p>
        <ul>
          <li><strong>Mobile:</strong> ${mobile}</li>
          <li><strong>City:</strong> ${city}</li>
          <li><strong>Business:</strong> ${business}</li>
        </ul>
        <p>We have also received your payment screenshot.</p>
        <p style="margin-top: 20px;">Best regards,<br><strong>Canton Fair Team</strong></p>
      </div>
    `;

    const mailOptionsUser = {
      from: `"Canton Fair Seminar" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '🎫 Registration Confirmed - Canton Fair Seminar',
      html: htmlBody,
      attachments: [
        {
          filename: payment.originalname,
          content: payment.buffer,
          contentType: payment.mimetype,
        },
      ],
    };

    const mailOptionsAdmin = {
      from: `"Canton Fair Notification" <${process.env.EMAIL_USER}>`,
      to: adminEmail,
      subject: `📥 New Registration from ${name}`,
      html: htmlBody,
      attachments: [
        {
          filename: payment.originalname,
          content: payment.buffer,
          contentType: payment.mimetype,
        },
      ],
    };

    // Optional delay between two mails (1 sec)
    await transporter.sendMail(mailOptionsUser);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await transporter.sendMail(mailOptionsAdmin);

    console.log(`✅ Email sent to ${email} and admin`);
    res.status(200).json({ message: 'Email sent successfully to user and admin' });
  } catch (err) {
    console.error('❌ Email send error:', err);
    res.status(500).json({ message: 'Failed to send email', error: err.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server is running at http://localhost:${PORT}`);
});
