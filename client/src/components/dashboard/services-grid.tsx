import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FINANCIAL_SERVICES } from "@/lib/constants";
import { Link } from "wouter";

const colorClasses = {
  blue: "bg-blue-100 text-blue-600",
  green: "bg-green-100 text-green-600",
  purple: "bg-purple-100 text-purple-600",
  yellow: "bg-yellow-100 text-yellow-600",
  indigo: "bg-indigo-100 text-indigo-600",
  red: "bg-red-100 text-red-600",
  teal: "bg-teal-100 text-teal-600",
  orange: "bg-orange-100 text-orange-600",
};

export function ServicesGrid() {
  return (
    <section className="mb-8" data-testid="services-grid">
      <h2 className="text-2xl font-bold text-foreground mb-6" data-testid="services-title">
        Our Financial Services
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {FINANCIAL_SERVICES.map((service) => (
          <Card 
            key={service.id}
            className="hover:shadow-md transition-shadow cursor-pointer group"
            data-testid={`service-${service.id}`}
          >
            <CardContent className="p-6">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${
                colorClasses[service.color as keyof typeof colorClasses]
              }`}>
                <i className={`${service.icon} text-xl`} data-testid={`service-icon-${service.id}`}></i>
              </div>
              
              <h3 className="font-bold text-foreground mb-2" data-testid={`service-name-${service.id}`}>
                {service.name}
              </h3>
              
              <p className="text-muted-foreground text-sm mb-4" data-testid={`service-description-${service.id}`}>
                {service.description}
              </p>
              
              <div className="text-sm text-muted-foreground mb-4" data-testid={`service-stats-${service.id}`}>
                {service.stats.map((stat, index) => (
                  <div key={index}>
                    <span>{stat}</span>
                    {index < service.stats.length - 1 && <br />}
                  </div>
                ))}
              </div>
              
              <Link href={`/${service.id}`}>
                <Button 
                  variant="link" 
                  className="p-0 text-finance-blue font-medium hover:underline group-hover:text-blue-700 transition-colors"
                  data-testid={`service-cta-${service.id}`}
                >
                  {service.cta}
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
