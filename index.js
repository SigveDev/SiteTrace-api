require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { Client, Databases, ID, Query } = require("node-appwrite");

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Initialize Appwrite Client
const client = new Client();
const databases = new Databases(client);

client
  .setEndpoint(process.env.ENDPOINT || "https://cloud.appwrite.io/v1") // Your Appwrite Endpoint
  .setProject(process.env.PROJECT_ID || "") // Your project ID
  .setKey(process.env.API_KEY || ""); // Your secret API key

function floatToIntWithMinOne(floatValue) {
  let roundedValue = Math.round(floatValue);
  if (roundedValue === 0) {
    return 1;
  }
  return roundedValue;
}

// Endpoint to receive analytics data
app.post("/analytics", async (req, res) => {
  const {
    url,
    referrer = "Unknown",
    userAgent = "Unknown",
    timestamp,
    sessionId,
    visitDuration = 0,
    browser,
    device = "Unknown",
    clicks = 0,
    scrollDepth = 0,
    screenResolution = "Unknown",
    viewportSize = "Unknown",
    loadTime = null,
    network = { effectiveType: "Unknown", downlink: null, rtt: null },
    focus = false,
    removeOneFromUnknownDevice = false,
  } = req.body;

  try {
    // Check if a document with the same sessionId already exists
    const existingDocuments = await databases.listDocuments(
      "669ec60f003b49ce1606", // Your database ID
      "66a2d232000302822fc1", // Your collection ID
      [Query.equal("sessionId", [sessionId])]
    );

    if (existingDocuments.total > 0) {
      res.status(201).json({ success: true, response: "Data received" });

      setImmediate(async () => {
        // Update the existing document
        const documentId = existingDocuments.documents[0].$id;
        await databases.updateDocument(
          "669ec60f003b49ce1606",
          "66a2d2a0003a5153d113",
          existingDocuments.documents[0].browser.$id,
          {
            name: browser.name,
            version: browser.version,
          }
        );
        await databases.updateDocument(
          "669ec60f003b49ce1606",
          "66a2d4410005fece34aa",
          existingDocuments.documents[0].network.$id,
          {
            effectiveType: network.effectiveType,
            downlink: Number(floatToIntWithMinOne(network.downlink)),
            rtt: network.rtt,
          }
        );
        const response = await databases.updateDocument(
          "669ec60f003b49ce1606",
          "66a2d232000302822fc1",
          documentId,
          {
            userAgent,
            device,
            visitDuration,
            clicks: existingDocuments.documents[0].clicks + clicks,
            scrollDepth:
              existingDocuments.documents[0].scrollDepth + scrollDepth,
            screenResolution,
            viewportSize,
            loadTime,
            focus,
          }
        );

        const totalAnalyticsRequest = await databases.listDocuments(
          "66a67e300033058839e7",
          "66abf41700087eac9f08",
          [Query.contains("url", [url])]
        );
        if (totalAnalyticsRequest.total > 0) {
          const analyticsDocumentId = totalAnalyticsRequest.documents[0].$id;
          const totalAnalytics = totalAnalyticsRequest.documents[0];
          await databases.updateDocument(
            "66a67e300033058839e7",
            "66abf41700087eac9f08",
            analyticsDocumentId,
            {
              interactions: totalAnalytics.interactions + clicks + scrollDepth,
            }
          );

          const browserAnalyticsRequest =
            totalAnalyticsRequest.documents[0].topBrowser.find(
              (topBrowser) => topBrowser.name === browser.name
            );

          if (!browserAnalyticsRequest) {
            await databases.createDocument(
              "66a67e300033058839e7",
              "66abf4c50019a8548c6c",
              ID.unique(),
              {
                analytics: analyticsDocumentId,
                name: browser.name,
                amount: 1,
              }
            );
          }

          const referrerAnalyticsRequest =
            totalAnalyticsRequest.documents[0].topReferrer.find(
              (topReferrer) => topReferrer.name === referrer
            );

          if (!referrerAnalyticsRequest) {
            await databases.createDocument(
              "66a67e300033058839e7",
              "66abf51e003195178367",
              ID.unique(),
              {
                analytics: analyticsDocumentId,
                name: referrer,
                amount: 1,
              }
            );
          }

          const deviceAnalyticsRequest =
            totalAnalyticsRequest.documents[0].topDevice.find(
              (topDevice) => topDevice.name === device
            );

          if (
            existingDocuments.documents[0].device === "Unknown" &&
            device !== "Unknown"
          ) {
            const documentId = deviceAnalyticsRequest.$id;
            await databases.updateDocument(
              "66a67e300033058839e7",
              "66abf5990001ff3009a9",
              documentId,
              {
                amount: deviceAnalyticsRequest.amount + 1,
              }
            );
          } else if (!deviceAnalyticsRequest) {
            await databases.createDocument(
              "66a67e300033058839e7",
              "66abf5990001ff3009a9",
              ID.unique(),
              {
                analytics: analyticsDocumentId,
                name: device,
                amount: 1,
              }
            );
          }

          if (removeOneFromUnknownDevice) {
            const unknownDeviceAnalyticsRequest =
              totalAnalyticsRequest.documents[0].topDevice.find(
                (topDevice) => topDevice.name === "Unknown"
              );

            if (unknownDeviceAnalyticsRequest) {
              const documentId = unknownDeviceAnalyticsRequest.$id;
              await databases.updateDocument(
                "66a67e300033058839e7",
                "66abf5990001ff3009a9",
                documentId,
                {
                  amount: unknownDeviceAnalyticsRequest.amount - 1,
                }
              );
            }
          }

          const correctedTimestamp = new Date(timestamp).setHours(0, 0, 0, 0);
          const correctedTimestampDate = new Date(correctedTimestamp);

          const analyticsOverTimeRequest =
            totalAnalytics.analyticsOverTime.find(
              (analytics) =>
                new Date(analytics.datetime).getTime() ===
                correctedTimestampDate.getTime()
            );

          if (!analyticsOverTimeRequest) {
            await databases.createDocument(
              "66a67e300033058839e7",
              "66ad3d9a00305e53d6f0",
              ID.unique(),
              {
                analytics: analyticsDocumentId,
                datetime: correctedTimestampDate,
                views: 1,
                interactions: clicks + scrollDepth,
              }
            );
          }
        } else {
          const correctedTimestamp = new Date(timestamp).setHours(0, 0, 0, 0);
          const correctedTimestampDate = new Date(correctedTimestamp);

          await databases.createDocument(
            "66a67e300033058839e7",
            "66abf41700087eac9f08",
            ID.unique(),
            {
              url,
              views: 1,
              interactions: clicks + scrollDepth,
              topBrowser: [{ name: browser.name, amount: 1 }],
              topReferrer: [{ name: referrer, amount: 1 }],
              topDevice: [{ name: device, amount: 1 }],
              analyticsOverTime: [
                {
                  datetime: correctedTimestampDate,
                  views: 1,
                  interactions: clicks + scrollDepth,
                },
              ],
            }
          );
        }
      });
    } else {
      // Create a new document
      const response = await databases.createDocument(
        "669ec60f003b49ce1606",
        "66a2d232000302822fc1",
        ID.unique(),
        {
          url,
          referrer,
          userAgent,
          timestamp,
          sessionId,
          visitDuration,
          browser,
          device,
          clicks,
          scrollDepth,
          screenResolution,
          viewportSize,
          loadTime,
          network,
          focus,
        }
      );

      const totalAnalyticsRequest = await databases.listDocuments(
        "66a67e300033058839e7",
        "66abf41700087eac9f08",
        [Query.contains("url", [url])]
      );
      if (totalAnalyticsRequest.total > 0) {
        const analyticsDocumentId = totalAnalyticsRequest.documents[0].$id;
        const totalAnalytics = totalAnalyticsRequest.documents[0];
        await databases.updateDocument(
          "66a67e300033058839e7",
          "66abf41700087eac9f08",
          analyticsDocumentId,
          {
            views: totalAnalytics.views + 1,
            interactions: totalAnalytics.interactions + clicks + scrollDepth,
          }
        );

        const browserAnalyticsRequest = totalAnalytics.topBrowser.find(
          (topBrowser) => topBrowser.name === browser.name
        );

        if (browserAnalyticsRequest) {
          const documentId = browserAnalyticsRequest.$id;
          await databases.updateDocument(
            "66a67e300033058839e7",
            "66abf4c50019a8548c6c",
            documentId,
            {
              amount: browserAnalyticsRequest.amount + 1,
            }
          );
        } else {
          await databases.createDocument(
            "66a67e300033058839e7",
            "66abf4c50019a8548c6c",
            ID.unique(),
            {
              analytics: analyticsDocumentId,
              name: browser.name,
              amount: 1,
            }
          );
        }

        const referrerAnalyticsRequest = totalAnalytics.topReferrer.find(
          (topReferrer) => topReferrer.name === referrer
        );

        if (referrerAnalyticsRequest) {
          const documentId = referrerAnalyticsRequest.$id;
          await databases.updateDocument(
            "66a67e300033058839e7",
            "66abf51e003195178367",
            documentId,
            {
              amount: referrerAnalyticsRequest.amount + 1,
            }
          );
        } else {
          await databases.createDocument(
            "66a67e300033058839e7",
            "66abf51e003195178367",
            ID.unique(),
            {
              analytics: analyticsDocumentId,
              name: referrer,
              amount: 1,
            }
          );
        }

        const deviceAnalyticsRequest = totalAnalytics.topDevice.find(
          (topDevice) => topDevice.name === device
        );

        if (deviceAnalyticsRequest) {
          const documentId = deviceAnalyticsRequest.$id;
          await databases.updateDocument(
            "66a67e300033058839e7",
            "66abf5990001ff3009a9",
            documentId,
            {
              amount: deviceAnalyticsRequest.amount + 1,
            }
          );
        } else {
          await databases.createDocument(
            "66a67e300033058839e7",
            "66abf5990001ff3009a9",
            ID.unique(),
            {
              analytics: analyticsDocumentId,
              name: device,
              amount: 1,
            }
          );
        }

        if (removeOneFromUnknownDevice) {
          const unknownDeviceAnalyticsRequest =
            totalAnalyticsRequest.documents[0].topDevice.find(
              (topDevice) => topDevice.name === "Unknown"
            );

          if (unknownDeviceAnalyticsRequest) {
            const documentId = unknownDeviceAnalyticsRequest.$id;
            await databases.updateDocument(
              "66a67e300033058839e7",
              "66abf5990001ff3009a9",
              documentId,
              {
                amount: unknownDeviceAnalyticsRequest.amount - 1,
              }
            );
          }
        }

        const correctedTimestamp = new Date(timestamp).setHours(0, 0, 0, 0);
        const correctedTimestampDate = new Date(correctedTimestamp);

        const analyticsOverTimeRequest = totalAnalytics.analyticsOverTime.find(
          (analytics) =>
            new Date(analytics.datetime).getTime() ===
            correctedTimestampDate.getTime()
        );

        if (analyticsOverTimeRequest) {
          const documentId = analyticsOverTimeRequest.$id;
          await databases.updateDocument(
            "66a67e300033058839e7",
            "66ad3d9a00305e53d6f0",
            documentId,
            {
              views: analyticsOverTimeRequest.views + 1,
              interactions:
                analyticsOverTimeRequest.interactions + clicks + scrollDepth,
            }
          );
        } else {
          await databases.createDocument(
            "66a67e300033058839e7",
            "66ad3d9a00305e53d6f0",
            ID.unique(),
            {
              analytics: analyticsDocumentId,
              datetime: correctedTimestampDate,
              views: 1,
              interactions: clicks + scrollDepth,
            }
          );
        }
      } else {
        const correctedTimestamp = new Date(timestamp).setHours(0, 0, 0, 0);
        const correctedTimestampDate = new Date(correctedTimestamp);

        await databases.createDocument(
          "66a67e300033058839e7",
          "66abf41700087eac9f08",
          ID.unique(),
          {
            url,
            views: 1,
            interactions: clicks + scrollDepth,
            topBrowser: [{ name: browser.name, amount: 1 }],
            topReferrer: [{ name: referrer, amount: 1 }],
            topDevice: [{ name: device, amount: 1 }],
            analyticsOverTime: [
              {
                datetime: correctedTimestampDate,
                views: 1,
                interactions: clicks + scrollDepth,
              },
            ],
          }
        );
      }
      res.status(200).json({ success: true, response });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
    console.error(error);
  }
});

app.listen(port, () => {
  console.log(`Analytics API listening at ${port}`);
});
