const express = require('express');
const nodemailer = require('nodemailer');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
require('dotenv').config();

const app = express();
const PORT = 5000;

// Middleware
app.use(cors({ origin: process.env.NODE_ENV === 'production' ? 'http://your-client-domain' : '*' }));
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
  limits: { fileSize: 5 * 1024 * 1024 },
});

// File-based counter for unique passId
const COUNTER_FILE = path.join(__dirname, 'passCounter.txt');

async function getNextPassId() {
  try {
    let counter;
    try {
      counter = parseInt(await fs.readFile(COUNTER_FILE, 'utf8')) || 0;
    } catch (err) {
      if (err.code === 'ENOENT') {
        await fs.writeFile(COUNTER_FILE, '0');
        counter = 0;
      } else {
        throw err;
      }
    }
    counter += 1;
    await fs.writeFile(COUNTER_FILE, counter.toString());
    console.log(`✅ Generated Pass ID: ${counter.toString().padStart(4, '0')}`);
    return counter.toString().padStart(4, '0');
  } catch (err) {
    console.error('❌ Counter error:', err);
    throw new Error('Failed to generate pass ID');
  }
}

// Generate unique passId
app.get('/generate-pass-id', async (req, res) => {
  try {
    const passId = await getNextPassId();
    res.status(200).json({ passId });
  } catch (err) {
    console.error('❌ Pass ID generation error:', err);
    res.status(500).json({ message: 'Failed to generate pass ID', error: err.message });
  }
});

// Email route
app.post('/send-email', upload.single('payment'), async (req, res) => {
  const { name, mobile, city, business, passId, passImage } = req.body;
  const payment = req.file;

  if (!name || !mobile || !/^\d{10}$/.test(mobile) || !city || !business || !payment || !passId || !passImage) {
    console.error('❌ Missing or invalid fields:', { name, mobile, city, business, passId, hasPayment: !!payment });
    return res.status(400).json({ message: 'Missing or invalid fields.' });
  }

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      pool: true,
      socketTimeout: 5000,
    });

    const passImageBuffer = Buffer.from(passImage.replace(/^data:image\/png;base64,/, ''), 'base64');
    const adminEmail = 'Adinathoverseasrjt@gmail.com';
    console.log(`📧 Sending email to: ${adminEmail} for ${name}, Pass ID: ${passId}`);
    await transporter.sendMail({
      from: `"Canton Fair Seminar" <${process.env.EMAIL_USER}>`,
      to: adminEmail,
      subject: `New Registration: Canton Fair Seminar - ${name}`,
      html: `
        <div style="font-family: 'Poppins', Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background: #f9f9f9;">
          <h2 style="color: #ffcc00; text-align: center; font-size: 24px; margin-bottom: 20px;">New Registration Details</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 10px; font-weight: 600; width: 30%;">Name:</td>
              <td style="padding: 10px;">${name}</td>
            </tr>
            <tr>
              <td style="padding: 10px; font-weight: 600;">Mobile:</td>
              <td style="padding: 10px;">${mobile}</td>
            </tr>
            <tr>
              <td style="padding: 10px; font-weight: 600;">City:</td>
              <td style="padding: 10px;">${city}</td>
            </tr>
            <tr>
              <td style="padding: 10px; font-weight: 600;">Business Type:</td>
              <td style="padding: 10px;">${business}</td>
            </tr>
            <tr>
              <td style="padding: 10px; font-weight: 600;">Pass ID:</td>
              <td style="padding: 10px;">${passId}</td>
            </tr>
          </table>
          <p style="margin-top: 20px; text-align: center; color: #555;">Please find the payment screenshot and event pass attached below.</p>
        </div>
      `,
      attachments: [
        {
          filename: payment.originalname,
          content: payment.buffer,
          contentType: payment.mimetype,
        },
        {
          filename: `EventPass_${passId}.png`,
          content: passImageBuffer,
          contentType: 'image/png',
        },
      ],
    });

    console.log(`✅ Email sent to ${adminEmail} for ${name}, Pass ID: ${passId}`);
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