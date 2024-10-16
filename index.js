const puppeteer = require('puppeteer');
const axios = require('axios');
const winston = require('winston');

// Winston Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level}]: ${message}`;
    })
  ),
  transports: [
    new winston.transports.File({ filename: 'job-application-log.log', level: 'info' }),
    new winston.transports.Console({ format: winston.format.simple() }) // Also log to console
  ]
});

async function scrapeJobs() {
  const browser = await puppeteer.launch({ headless: false, args: ['--start-maximized'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1512, height: 796 });

  // Go to the Freelancer dashboard
  try {
    await page.goto('https://www.freelancer.com/dashboard', { waitUntil: 'networkidle2' });
  } catch (err) {
    logger.error('Failed to navigate to the dashboard: ' + err);
    return;
  }

  let currentPageUrl = await page.url();
  if (currentPageUrl.includes("/login")) {
    logger.info("\n\nLogin required. Proceeding to log in...");

    try {
      const emailSelector = 'input[id="emailOrUsernameInput"]';
      const passwordSelector = 'input[id="passwordInput"]';
      const loginSubmitSelector = 'button[type="submit"]';

      // Enter login credentials
      await page.type(emailSelector, '');
      await page.type(passwordSelector, '');
      await page.click(loginSubmitSelector);

      // Wait for navigation after login
      await page.waitForNavigation({ waitUntil: 'networkidle2' });
      await page.waitForSelector('.ModalContainer', { timeout: 30000 });

      // Check if the ModalContainer exists and remove it if it does
      await page.evaluate(() => {
        const modalContainer = document.getElementsByClassName("ModalContainer");
        if (modalContainer.length > 0) {
          modalContainer[0].remove(); // Remove the first ModalContainer found
          // logger.info("ModalContainer removed successfully.");
        }
      });
      logger.info("Logged in successfully. Redirected to: " + page.url());
    } catch (error) {
      logger.error('Login failed: ' + error);
      return;
    }
  } else {
    logger.info("Already logged in. No login required.");
  }

  const processedJobs = new Set();
  let appliedJobsCount = 0; // Initialize applied jobs count
  // Experienced Full Stack Developer Needed for Web and App Development
  // Function to monitor jobs and stop after 10 applications
  const monitorJobs = async () => {
    const interval = setInterval(async () => {
      if (appliedJobsCount >= 10) {
        logger.info('Reached the limit of 10 project applications. Stopping the script.');
        clearInterval(interval); // Stop the interval
        await browser.close(); // Close the browser
        return;
      }

      try {
        const container = await page.evaluate(() => {
          const jobContainer = document.getElementsByClassName("ToastContainer");
          if (jobContainer && jobContainer.length > 0) {
            return jobContainer[0].firstElementChild.href; // Get the job link
          }
          return null;
        });
        if (container && !processedJobs.has(container)) {
          processedJobs.add(container); // Mark job as processed
          logger.info(`\n\nFound new job: ${container}`);
          
          const jobPage = await browser.newPage();
          await jobPage.setViewport({ width: 1512, height: 796 });

          try {
            await jobPage.goto(container, { waitUntil: 'networkidle2' });
            const successfullyApplied = await processJob(jobPage);

            // If successfully applied, increment the counter
            if (successfullyApplied) {
              // appliedJobsCount += 1;
              logger.info(`Successfully applied for ${appliedJobsCount} job(s).`);
            }
          } catch (error) {
            logger.error('Failed to open or process job: ' + error);
          } finally {
            // setTimeout(async()=>{await jobPage.close();},3000)
            //  // Ensure page is closed
          }
        }
      } catch (error) {
        logger.error("Error monitoring jobs: " + error);
      }
    }, 500); // Check every 500ms
  };

  monitorJobs();
}

async function processJob(jobPage) {
  logger.info("Processing job: " + jobPage.url());

  try {
    await jobPage.waitForSelector('.ProjectDescription', { timeout: 5000 });
  } catch (error) {
    logger.error("Project description not found: " + error);
    return false; // No application made
  }

//   const p = await jobPage.evaluate(() => {
//     const projectDescriptionElement = document.getElementsByClassName("ProjectDescription");
//     const ProjectViewDetailsSkills = document.getElementsByClassName("ProjectViewDetailsSkills");
//     const projectUploadTime = document.getElementsByClassName("ProjectViewDetails-budget")[0].children[2].textContent.toLowerCase().includes("23 hours")
   
//     let details = { description: null, skills: null, projectUploadTime };
//     if(projectUploadTime){
//     if (projectDescriptionElement && projectDescriptionElement.length > 0) {
//       details.description = projectDescriptionElement[0].textContent.trim();
//     }
    
//     if (ProjectViewDetailsSkills && ProjectViewDetailsSkills.length > 0) {
//       details.skills = ProjectViewDetailsSkills[0].textContent.trim();
//     }
//   }
//     return details;
//   });

//   if (p && p.description &&p.projectUploadTime) {
//     const compositePrompt = `
// You are a skill assessment AI. Based on the following skills and experiences provided, evaluate whether the user has the necessary qualifications to handle a job successfully. The user needs to be at least 70% qualified for this role. Please respond with "yes" or "no" only.

// **User Profile:**
// - Frontend Skills: HTML, CSS, JavaScript, React.js, Redux, Next.js
// - Backend Skills: Node.js, Express.js, RESTful APIs, GraphQL, Python (Flask)
// - Database Skills: MongoDB, Firebase, NoSQL Databases
// - Tools/Technologies: Git, CI/CD, Google Cloud Platform (GCP), AWS
// - Professional Experience: Full-stack MERN developer with 4 years of experience, including cloud expertise. Currently a Software Engineer with a focus on building web applications.

// **Job Description:**
// ${p.description}

// **Required Skills:**
// ${p.skills || ""}

// Please analyze the user's skills and experiences against the job requirements and determine if the user is at least 70% qualified to apply for this job. Respond with "yes" or "no" only.
//     `;

//     try {
// //       const qualificationAssessment = await openAIAPI(compositePrompt);
// //       // if (qualificationAssessment.toLowerCase() === "yes") {
// //       if (qualificationAssessment.toLowerCase()) {
// //         const projectApplyPrompt = `
// // You are an expert proposal writer. Write a bid proposal for a Freelancer project that starts with "Hi," and emphasizes the user's eagerness for the project. The proposal should be engaging, concise, and to the point.

// // **User Profile:**
// // - Frontend Skills: HTML, CSS, JavaScript, React.js, Redux, Next.js
// // - Backend Skills: Node.js, Express.js, RESTful APIs, GraphQL, Python (Flask)
// // - Database Skills: MongoDB, Firebase, NoSQL Databases
// // - Tools/Technologies: Git, CI/CD, Google Cloud Platform (GCP), AWS
// // - Professional Experience: Full-stack MERN developer with 4 years of experience, including cloud expertise. Currently a Software Engineer with a focus on building web applications.
// //         `;

// //         let bidProposal = await openAIAPI(projectApplyPrompt);
// //         bidProposal = bidProposal.replace("[Your Name]", "Feku Sharma");

// //         if (bidProposal) {
// //           await fillProposalInTextArea(jobPage, bidProposal);
          
// //           try {
// //             // Wait for the buttons to be present
// //             await jobPage.waitForSelector('.BidFormBtn');
        
// //             // Click the second button with class "BidFormBtn"
// //             await jobPage.evaluate(() => {
// //               const buttons = document.getElementsByClassName("BidFormBtn");
// //               if (buttons.length > 1) {
// //                 buttons[1].scrollIntoView();
// //               //  setTimeout(()=>{buttons[1].click(); },500) // Click the second button
               
// //               } else {
// //                 console.error("Less than two BidFormBtn buttons found.");
// //               }
// //             });
// //             // const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// // // Usage in your Puppeteer code
// //             // await wait(3000);
// //             logger.info("Successfully submitted proposal for job: " + jobPage.url());
// //             return true
            
// //           } catch (error) {
// //             console.error("Error during bid submission:", error.message);
// //             logger.error(`Error during bid submission: ${error.message}`);
// //           }
// //         }
//       // }else{
//       //   logger.info("Qualification not sufficient");
//       // }
//     } catch (error) {
//       logger.error('Error during job qualification or proposal generation: ' + error);
//     }
//   }else{
//     logger.info("Job description or qualification or projectUploadTime not sufficient to apply.");
//   }

  
  return false;
}

async function fillProposalInTextArea(page, proposalText) {
  try {
    await page.waitForSelector('#descriptionTextArea');

    // Focus on the textarea and clear any existing text
    await page.focus('#descriptionTextArea');
    await page.evaluate(() => {
      const textArea = document.getElementById('descriptionTextArea');
      textArea.value = '';  // Clear the textarea
    });

    // Type the proposal text with a slight delay to simulate real typing
    await page.keyboard.type(proposalText, { delay: 1 });

    // Dispatch necessary events to ensure the input is recognized
    await page.evaluate(() => {
      const textArea = document.getElementById('descriptionTextArea');
      textArea.dispatchEvent(new Event('input', { bubbles: true }));
      textArea.dispatchEvent(new Event('change', { bubbles: true }));
      textArea.blur();  // Trigger blur event to simulate user leaving the field
    });

    logger.info('Proposal typed and textarea blurred successfully');
  } catch (error) {
    logger.error('Failed to type proposal: ' + error);
  }
}



const openAIAPI = async (promptValue) => {
  const randomQueryParam = Math.floor(Math.random() * 10000);
  const apiUrl = `https://api.openai.com/v1/chat/completions?v=${randomQueryParam}`; // OpenAI API URL

  const body = {
    model: "gpt-3.5-turbo",
    messages: [{ role: "user", content: promptValue }],
    temperature: 0,
    max_tokens: 300,
    n: 1,
    stop: null,
  };
const API_KEY=""
  try {
    const response = await axios.post(apiUrl, body, {
      headers: {
        // Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    return response.data.choices[0].message.content;
  } catch (error) {
    logger.error("Error calling OpenAI API: " + error);
    return null;
  }
};

scrapeJobs();
