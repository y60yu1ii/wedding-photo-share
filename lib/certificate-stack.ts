import * as cdk from "aws-cdk-lib";
import * as certificatemanager from "aws-cdk-lib/aws-certificatemanager";
import * as route53 from "aws-cdk-lib/aws-route53";

export class CertificateStack extends cdk.Stack {
  public readonly siteCertificateArn: string;
  public readonly apiCertificateArn: string;

  constructor(scope: cdk.App, id: string, props: cdk.StackProps & { hostedZoneId: string }) {
    super(scope, id, {
      ...props,
      env: { account: props.env?.account || process.env.CDK_DEFAULT_ACCOUNT!, region: "us-east-1" },
      crossRegionReferences: true,
    });

    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, "HostedZone", {
      hostedZoneId: props.hostedZoneId,
      zoneName: "fishare.de",
    });

    // Site certificate for wedding.fishare.de (covers *.fishare.de)
    const siteCert = new certificatemanager.DnsValidatedCertificate(this, "SiteCert", {
      domainName: "wedding.fishare.de",
      subjectAlternativeNames: ["*.fishare.de"],
      hostedZone,
    });

    // API certificate for api.fishare.de
    const apiCert = new certificatemanager.DnsValidatedCertificate(this, "ApiCert", {
      domainName: "api.fishare.de",
      hostedZone,
    });

    this.siteCertificateArn = siteCert.certificateArn;
    this.apiCertificateArn = apiCert.certificateArn;
  }
}
