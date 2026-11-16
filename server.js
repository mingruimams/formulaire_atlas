const Joi = require('joi');
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const cors = require('cors');
const { HttpsProxyAgent } = require('https-proxy-agent');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use(limiter);

//app.use(cors({origin: true, credentials: true}));
app.use(cors());
app.use(bodyParser.json());

// Configuration Grist
const GRIST_API_KEY = process.env.GRIST_API_KEY;
const GRIST_DOC_URL = process.env.GRIST_DOC_URL;
const GRIST_TABLE_NAME = process.env.GRIST_TABLE_NAME;

const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
const proxyAgent = proxyUrl ? new HttpsProxyAgent(proxyUrl) : null;

// JOI - schéma de validation
const recordSchema = Joi.object({
  Nom: Joi.string().min(1).required(),
  Prenom: Joi.string().allow('').optional(),
  Mail: Joi.string().email().required(),
  Etablissement: Joi.string().allow('').optional(),
  Point: Joi.string().min(1).required(),
  Lat: Joi.number().precision(6).required(),
  Long: Joi.number().precision(6).required(),
  Commentaire: Joi.string().allow('').optional()
});

// Route POST sécurisée
app.post('/api/points', async (req, res) => {
  try {
    // On ne log que la longueur du tableau, pas les données sensibles
    const records = req.body.records || [];
    if (records.length === 0) {
      return res.status(400).json({
        error: "Aucun enregistrement trouvé",
        details: "Le corps de la requête doit contenir un tableau 'records' avec au moins un enregistrement."
      });
    }

    const results = [];
    for (const record of records) {
      const { error, value } = recordSchema.validate(record.fields, { abortEarly: false, stripUnknown: true });
      if (error) {
        return res.status(400).json({
          error: "Validation des données échouée.",
          details: error.details.map(e => e.message)
        });
      }

      const axiosConfig = {
        headers: {
          'Authorization': `Bearer ${GRIST_API_KEY}`,
          'Content-Type': 'application/json'
        }
      };
      if (proxyAgent) {
        axiosConfig.httpsAgent = proxyAgent;
        axiosConfig.proxy = false;
      }

      // On n’envoie que les champs validés Joi
      const gristRecord = {
        records: [{
          fields: value // valeur validée et nettoyée
        }]
      };

      const response = await axios.post(
        `${GRIST_DOC_URL}/tables/${GRIST_TABLE_NAME}/records`,
        gristRecord,
        axiosConfig
      );

      results.push(response.data);
    }

    res.status(201).json({
      success: true,
      message: `${results.length} point(s) enregistré(s) avec succès dans Grist`,
      data: results
    });

  } catch (error) {
    if (error.response) {
      res.status(error.response.status).json({
        error: "Erreur Grist",
        details: error.response.data
      });
    } else if (error.request) {
      res.status(500).json({
        error: "Erreur de connexion à Grist",
        details: "Impossible de contacter Grist. Vérifiez le proxy ou l'URL."
      });
    } else {
      res.status(500).json({
        error: "Erreur serveur",
        details: error.message
      });
    }
  }
});

app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});