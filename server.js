require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const cors = require('cors');
const { HttpsProxyAgent } = require('https-proxy-agent');

// Initialisation de l'application Express
const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Configuration Grist
const GRIST_API_KEY = process.env.GRIST_API_KEY;
const GRIST_DOC_URL = process.env.GRIST_DOC_URL;
const GRIST_TABLE_NAME = process.env.GRIST_TABLE_NAME;

// Configuration du proxy
const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
const proxyAgent = proxyUrl ? new HttpsProxyAgent(proxyUrl) : null;

// Route POST pour recevoir les données du front-end
app.post('/api/points', async (req, res) => {
  try {
    console.log("Requête reçue :", req.body);

    const records = req.body.records || [];
    if (records.length === 0) {
      return res.status(400).json({
        error: "Aucun enregistrement trouvé",
        details: "Le corps de la requête doit contenir un tableau 'records' avec au moins un enregistrement."
      });
    }

    const results = [];
    for (const record of records) {
      const fields = record.fields || {};
      const {
        Nom,
        Prenom = "",
        Mail,
        Etablissement = "",
        Point,
        Lat,
        Long,
        Commentaire = ""
      } = fields;

      if (!Nom || !Mail || !Point || Lat === undefined || Long === undefined) {
        return res.status(400).json({
          error: "Champs manquants",
          details: `Les champs Nom, Mail, Point, Lat et Long sont obligatoires. Reçu : ${JSON.stringify(fields)}`
        });
      }

      const newRecord = {
        records: [{
          fields: {
            Nom,
            Prenom,
            Mail,
            Etablissement,
            Point,
            Lat: parseFloat(Lat),
            Long: parseFloat(Long),
            Commentaire
          }
        }]
      };

      const axiosConfig = {
        headers: {
          'Authorization': `Bearer ${GRIST_API_KEY}`,
          'Content-Type': 'application/json'
        }
      };
      // Si un proxy est configuré, l'utiliser pour la requête
      if (proxyAgent) {
        axiosConfig.httpsAgent = proxyAgent;
        axiosConfig.proxy = false;
      }

      const response = await axios.post(
        `${GRIST_DOC_URL}/tables/${GRIST_TABLE_NAME}/records`,
        newRecord,
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
    console.error("Erreur complète :", error);
    if (error.response) {
      console.error("Réponse de Grist :", error.response.data);
      res.status(error.response.status).json({
        error: "Erreur Grist",
        details: error.response.data
      });
    } else if (error.request) {
      console.error("Aucune réponse reçue de Grist :", error.request);
      res.status(500).json({
        error: "Erreur de connexion à Grist",
        details: "Impossible de contacter Grist. Vérifiez le proxy ou l'URL."
      });
    } else {
      console.error("Erreur locale :", error.message);
      res.status(500).json({
        error: "Erreur serveur",
        details: error.message
      });
    }
  }
});

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});