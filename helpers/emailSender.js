const nodemailer = require("nodemailer");
const dotenv = require('dotenv');
const path = require('path');
const Promise = require('bluebird');
const EmailTemplate = require('email-templates').EmailTemplate;
const sgMailer = require('nodemailer-sendgrid-transport');
dotenv.config();
const transport = nodemailer.createTransport(sgMailer({
    auth:{
        api_key:process.env.SENDGRID_API_KEY
    }
}));






const sender = (tName, options, attachments) => {
    const sendEmail = opts => {
        return transport.sendMail(opts);
    };

    const loadTemplate = (templateName, contexts) => {
        const templatePath = path.join(
            __dirname,
            '..',
            'templates',
            'emailTemplates',
            templateName
        );
        let template = new EmailTemplate(templatePath);
        return Promise.all(
            contexts.map(context => {
                return new Promise((resolve, reject)=>{
                    template.render(context,(err, result)=>{
                        if (err) reject(err);
                        else resolve({email:result, context})
                    });
                });
            })
        );
    }
    return loadTemplate(tName, options).then(results => {
        return Promise.all(results.map(result => {
            sendEmail({
                to: result.context.email,
                from: 'dev@hlth.network',
                subject: result.email.subject,
                html: result.email.html,
                text: result.email.text,
                attachments: attachments,
                name: result.email.name|| null,
                otp: result.email.otp,
                ...result.email
            })
        }));
    });
}




const senderOtpSimple = ( options) => {

transport.sendMail({
  from: 'dev@hlth.network',
  subject: options.subject,
  html:options.html,
  to: options.email,


  otp: options.otp,
}).then((d) => {})
      .catch((e) => e);;
}


const simpleEmail = async (to , data) => {
    const simepleTransporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.MARKETING_EMAIL,
        pass: process.env.MARKETING_PASSWORD,
      },
    });

    
    
    const options = {
        from: "team@hlth.run",
        to,
        subject: data.subject,
        text: data.text,
        html: data.html,
    };
    
    return simepleTransporter
      .sendMail(options)
      .then((d) => {})
      .catch((e) => e);
}




const marketingEmail = async (tName, options, attachments) => {
    const simepleTransporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.MARKETING_EMAIL,
        pass: process.env.MARKETING_PASSWORD,
      },
    });
    const sendMarketingEmail = opts => {
        return simepleTransporter.sendMail(opts).then(d => {}).catch(e => e);
    };

    const loadTemplate = (templateName, contexts) => {
      const templatePath = path.join(
        __dirname,
        "..",
        "templates",
        "emailTemplates",
        templateName
      );
      let template = new EmailTemplate(templatePath);
      return Promise.all(
        contexts.map((context) => {
          return new Promise((resolve, reject) => {
            template.render(context, (err, result) => {
              if (err) reject(err);
              else resolve({ email: result, context });
            });
          });
        })
      );
    };
    return loadTemplate(tName, options).then((results) => {
      return Promise.all(
        results.map((result) => {
          sendMarketingEmail({
            to: result.context.email,
            from: "team@hlth.run",
            subject: result.email.subject,
            html: result.email.html,
            text: result.email.text,
            attachments: attachments,
            name: result.email.name || null,
            otp: result.email.otp,
            ...result.email,
          });
        })
      );
    });

};
module.exports = {
    sender,
    simpleEmail, marketingEmail,senderOtpSimple
}
