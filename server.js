const express = require('express');
const nodemailer = require('nodemailer');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
require('dotenv').config();

const app = express();
const PORT = 5000;

// File to store the last Pass ID
const PASS_ID_FILE = path.join(__dirname, 'passIdCounter.json');

// Initialize Pass ID counter
let lastPassId = 0;

// Load the last Pass ID from file on server start
async function loadPassIdCounter() {
  try {
    const data = await fs.readFile(PASS_ID_FILE, 'utf8');
    const json = JSON.parse(data);
    lastPassId = json.lastPassId || 0;
    console.log(`✅ Loaded last Pass ID: ${lastPassId}`);
  } catch (err) {
    if (err.code === 'ENOENT') {
      // File doesn't exist, initialize with 0
      await savePassIdCounter();
      console.log('✅ Created new Pass ID counter file');
    } else {
      console.error('❌ Error loading Pass ID counter:', err);
    }
  }
}

// Save the last Pass ID to file
async function savePassIdCounter() {
  try {
    await fs.writeFile(PASS_ID_FILE, JSON.stringify({ lastPassId }));
  } catch (err) {
    console.error('❌ Error saving Pass ID counter:', err);
  }
}

// Generate the next Pass ID (thread-safe)
async function generatePassId() {
  lastPassId += 1;
  await savePassIdCounter();
  return lastPassId.toString().padStart(4, '0'); // Format as 0001, 0002, etc.
}

// Load Pass ID counter on server start
loadPassIdCounter();

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

// Setup transporter with timeouts and port 587
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

// Generate Pass ID route
app.get('/generate-pass-id', async (req, res) => {
  try {
    const passId = await generatePassId();
    res.status(200).json({ passId });
  } catch (err) {
    console.error('❌ Error generating Pass ID:', err);
    res.status(500).json({ message: 'Failed to generate Pass ID', error: err.message });
  }
});

// Email route
app.post('/send-email', upload.fields([{ name: 'payment', maxCount: 1 }, { name: 'passImage', maxCount: 1 }]), async (req, res) => {
  const { name, email, mobile, city, business, passId } = req.body;
  const payment = req.files['payment'] ? req.files['payment'][0] : null;
  const passImage = req.files['passImage'] ? req.files['passImage'][0] : null;

  if (!name || !email || !mobile || !/^\d{10}$/.test(mobile) || !city || !business || !payment || !passId || !passImage) {
    return res.status(400).json({ message: 'Missing or invalid fields.' });
  }

  const adminEmail = 'Adinathoverseasrjt@gmail.com';

  try {
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; background: #f9f9f9; padding: 20px; border-radius: 10px; max-width: 600px; margin: auto;">
        <h2 style="color: #007bff;">🎉 Registration Confirmed!</h2>
        <p>Hello <strong>${name}</strong>,</p>
        <p>Thank you for registering for the <strong>Canton Fair Seminar</strong>. Your unique Pass ID is:</p>
        <h3 style="color: #28a745;">Pass ID: ${passId}</h3>
        <p>Below are your details:</p>
        <ul>
          <li><strong>Mobile:</strong> ${mobile}</li>
          <li><strong>City:</strong> ${city}</li>
          <li><strong>Business:</strong> ${business}</li>
        </ul>
        <p>We have received your payment screenshot and pass image.</p>
        <p style="margin-top: 20px;">Best regards,<br><strong>Canton Fair Team</strong></p>
      </div>
    `;

    const mailOptionsUser = {
      from: `"Canton Fair Seminar" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `🎫 Registration Confirmed - Canton Fair Seminar (Pass ID: ${passId})`,
      html: htmlBody,
      attachments: [
        {
          filename: payment.originalname,
          content: payment.buffer,
          contentType: payment.mimetype,
        },
        {
          filename: `CantonFair_Pass_${name}_${passId}.png`,
          content: passImage.buffer,
          contentType: passImage.mimetype,
        },
      ],
    };

    const mailOptionsAdmin = {
      from: `"Canton Fair Notification" <${process.env.EMAIL_USER}>`,
      to: adminEmail,
      subject: `📥 New Registration from ${name} (Pass ID: ${passId})`,
      html: htmlBody,
      attachments: [
        {
          filename: payment.originalname,
          content: payment.buffer,
          contentType: payment.mimetype,
        },
        {
          filename: `CantonFair_Pass_${name}_${passId}.png`,
          content: passImage.buffer,
          contentType: passImage.mimetype,
        },
      ],
    };

    // Send emails with a delay
    await transporter.sendMail(mailOptionsUser);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await transporter.sendMail(mailOptionsAdmin);

    console.log(`✅ Email sent to ${email} and admin with Pass ID: ${passId}`);
    res.status(200).json({ message: 'Email sent successfully to user and admin', passId });
  } catch (err) {
    console.error('❌ Email send error:', err);
    res.status(500).json({ message: 'Failed to send email', error: err.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server is running at http://localhost:${PORT}`);
});