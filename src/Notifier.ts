import nodemailer from "nodemailer";

export class Notifier {
    private transporter: any;
    private user: string; 

    constructor(user: string, pass: string) {
        this.user = user;
        this.transporter = nodemailer.createTransport({
          host: "smtp.gmail.com",
          port: 465,
          secure: true,
          auth: {
            user: user,
            pass: pass 
          }
        });
    }

    async sendMessage(recipient: string, subject: string, html: string): Promise<string | null> {
        const info = await this.transporter.sendMail({
            from: `"ZkFold Smart Wallet" <${this.user}>`, // sender address 
            to: recipient, // list of receivers
            subject: subject, // Subject
            html: html 
          }).catch(console.error);
    
          return info ? info.messageId : null;
    }
}

