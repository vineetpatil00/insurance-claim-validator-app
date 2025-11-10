import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { ClaimsService } from '../_services/claims.service';
import { firstValueFrom } from 'rxjs';

interface ValidationResult {
  name: string;
  status: 'passed' | 'review' | 'mismatch';
  confidence: number;
  mismatches?: string[];
}

interface PolicyDetails {
  name: string;
  vehicleRegNo: string;
  policyStart: string;
  policyExpiry: string;
}

export interface Claim {
  id: string;
  claim_number?: string;
  description?: string;
  status: 'created' | 'draft' | 'documents_uploaded' | 'images_uploaded' | 'validating' | 'completed' | 'validated';
  createdAt: string;
  documents?: any[];
  images?: any[];
  validationResults?: ValidationResult[];
  policyDetails?: PolicyDetails;
  overallConfidence?: number;
  manualReviewRequired?: number;
}

@Component({
  selector: 'app-claim-validator',
  templateUrl: './claim-validator.component.html',
  styleUrls: ['./claim-validator.component.scss']
})
export class ClaimValidatorComponent implements OnInit {
  // Current claim
  currentClaim: Claim | null = null;
  claimId: string | null = null;
  isExistingClaim: boolean = false;

  // Claim form fields
  claimNumber: string = '';
  description: string = '';

  // Steps
  currentStep: number = 1;
  totalSteps: number = 4;
  steps = [
    { number: 1, title: 'Create Claim', route: 'create' },
    { number: 2, title: 'Upload Documents', route: 'documents' },
    { number: 3, title: 'Upload Images', route: 'images' },
    { number: 4, title: 'Validate & Results', route: 'validate' }
  ];

  // File uploads
  policyDocument: File | null = null;
  claimForm: File | null = null;
  drivingLicense: File | null = null;
  aadhaar: File | null = null;
  pan: File | null = null;
  repairEstimate: File | null = null;
  carImages: File[] = [];

  // Upload status
  documentsUploaded: boolean = false;
  imagesUploaded: boolean = false;

  // Validation results
  validationResults: ValidationResult[] = [];
  policyDetails: PolicyDetails | null = null;
  overallConfidence: number = 0;
  manualReviewRequired: number = 0;
  validationIssues: string[] = [];
  validationWarnings: string[] = [];
  damageAnalysis: any = null;

  // Processing states
  isCreatingClaim: boolean = false;
  isUploadingDocuments: boolean = false;
  isUploadingImages: boolean = false;
  isValidating: boolean = false;
  isFetchingClaim: boolean = false;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private claimsService: ClaimsService
  ) { }

  ngOnInit(): void {
    // Check route parameters
    this.route.params.subscribe(params => {
      // Always read claimId from route params if present
      if (params['id']) {
        const routeClaimId = params['id'];
        const stepParam = params['step'];
        
        // Always set claimId from route - this ensures it's available even if component state was reset
        const claimIdChanged = this.claimId !== routeClaimId;
        this.claimId = routeClaimId;
        
        // Set step from route if provided
        if (stepParam) {
          const stepIndex = this.steps.findIndex(s => s.route === stepParam);
          if (stepIndex >= 0) {
            this.currentStep = stepIndex + 1;
          }
        }
        
        // Only load existing claim if claimId changed (to avoid unnecessary API calls)
        if (claimIdChanged) {
          this.isExistingClaim = true;
          this.loadExistingClaim();
        }
      } else {
        // No ID in route - new claim flow
        const stepParam = params['step'];
        if (stepParam) {
          const stepIndex = this.steps.findIndex(s => s.route === stepParam);
          if (stepIndex >= 0) {
            this.currentStep = stepIndex + 1;
          } else {
            this.currentStep = 1;
          }
        } else {
          this.currentStep = 1;
        }
        // Keep claimId if it was set (e.g., from createClaim) - don't reset it
        // When navigating with navigateToStep(), claimId will be included in route
      }
    });
    
    // Also check route params immediately (for initial load)
    const currentParams = this.route.snapshot.params;
    if (currentParams['id'] && !this.claimId) {
      this.claimId = currentParams['id'];
      this.isExistingClaim = true;
      const stepParam = currentParams['step'];
      if (stepParam) {
        const stepIndex = this.steps.findIndex(s => s.route === stepParam);
        if (stepIndex >= 0) {
          this.currentStep = stepIndex + 1;
        }
      }
      this.loadExistingClaim();
    } else if (currentParams['step'] && !currentParams['id']) {
      const stepParam = currentParams['step'];
      const stepIndex = this.steps.findIndex(s => s.route === stepParam);
      if (stepIndex >= 0) {
        this.currentStep = stepIndex + 1;
      }
    }
  }

  // Load existing claim - GET /api/v1/claims/{claim_id}
  loadExistingClaim(): void {
    if (!this.claimId) return;
    
    this.isFetchingClaim = true;
    
    this.claimsService.getClaim(this.claimId).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const claimData = response.data as any;
          
          // Extract policy details from policy document
          let policyDetails = null;
          const policyDoc = claimData.documents?.find((doc: any) => doc.document_type === 'policy');
          if (policyDoc?.extracted_data) {
            const policyData = policyDoc.extracted_data;
            policyDetails = {
              name: policyData.insured_name || 'N/A',
              vehicleRegNo: policyData.vehicle_registration || 'N/A',
              policyStart: policyData.policy_start_date ? new Date(policyData.policy_start_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A',
              policyExpiry: policyData.policy_expiry_date ? new Date(policyData.policy_expiry_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'
            };
          }
          
          // Map validation object to validationResults array
          let validationResults: ValidationResult[] = [];
          if (claimData.validation) {
            const validation = claimData.validation;
            
            if (validation.name_validation) {
              validationResults.push({
                name: 'Name Validation',
                status: validation.name_validation.is_valid ? 'passed' : 'mismatch',
                confidence: validation.name_validation.confidence || 0,
                mismatches: validation.name_validation.mismatches || []
              });
            }
            
            if (validation.vehicle_validation) {
              validationResults.push({
                name: 'Vehicle Validation',
                status: validation.vehicle_validation.is_valid ? 'passed' : 'mismatch',
                confidence: validation.vehicle_validation.confidence || 0,
                mismatches: validation.vehicle_validation.mismatches || []
              });
            }
            
            if (validation.date_validation) {
              validationResults.push({
                name: 'Date Validation',
                status: validation.date_validation.is_valid ? 'passed' : 'review',
                confidence: validation.date_validation.confidence || 0,
                mismatches: validation.date_validation.mismatches || []
              });
            }
            
            if (validation.damage_validation) {
              // Use is_valid if available, otherwise use matches_description, default to 'review'
              const isValid = validation.damage_validation.is_valid !== undefined 
                ? validation.damage_validation.is_valid 
                : (validation.damage_validation.matches_description || false);
              validationResults.push({
                name: 'Damage Validation',
                status: isValid ? 'passed' : 'review',
                confidence: validation.damage_validation.confidence || 0,
                mismatches: validation.damage_validation.mismatches || []
              });
            }
          }
          
          // Map backend format to component format
          // Preserve 'validated' status as is, since template checks for both 'completed' and 'validated'
          const mappedClaim = {
            id: claimData._id || claimData.id,
            claim_number: claimData.claim_number,
            description: claimData.description,
            status: (claimData.status === 'validated' ? 'validated' : (claimData.status || 'created')) as any,
            createdAt: claimData.CreatedOn || claimData.createdAt,
            documents: claimData.documents || [],
            images: claimData.images || [],
            validationResults: validationResults,
            policyDetails: policyDetails,
            overallConfidence: claimData.validation?.overall_confidence || 0,
            manualReviewRequired: claimData.validation?.overall_valid === false ? 1 : 0
          } as any;
          
          this.currentClaim = mappedClaim;
          this.validationResults = validationResults;
          this.policyDetails = policyDetails;
          this.overallConfidence = mappedClaim.overallConfidence;
          this.manualReviewRequired = mappedClaim.manualReviewRequired;
          this.validationIssues = claimData.validation?.issues || [];
          this.validationWarnings = claimData.validation?.warnings || [];
          this.damageAnalysis = claimData.validation?.damage_validation || null;
          
          // Set upload flags based on documents and images before determining step
          if (mappedClaim.documents && mappedClaim.documents.length > 0) {
            this.documentsUploaded = true;
          }
          if (mappedClaim.images && mappedClaim.images.length > 0) {
            this.imagesUploaded = true;
          }
          
          this.determineCurrentStep();
        } else {
          alert(response.error || 'Failed to load claim');
        }
        this.isFetchingClaim = false;
      },
      error: (error) => {
        console.error('Error loading claim:', error);
        alert('Failed to load claim. Please try again.');
        this.isFetchingClaim = false;
      }
    });
  }

  determineCurrentStep(): void {
    if (!this.currentClaim) return;

    // Set upload flags based on documents and images
    if (this.currentClaim.documents && this.currentClaim.documents.length > 0) {
      this.documentsUploaded = true;
    }
    if (this.currentClaim.images && this.currentClaim.images.length > 0) {
      this.imagesUploaded = true;
    }

    switch (this.currentClaim.status) {
      case 'created':
      case 'draft':
        this.currentStep = this.documentsUploaded ? 3 : 2;
        break;
      case 'documents_uploaded':
        this.currentStep = 3;
        this.documentsUploaded = true;
        break;
      case 'images_uploaded':
        this.currentStep = 4;
        this.documentsUploaded = true;
        this.imagesUploaded = true;
        break;
      case 'validating':
      case 'completed':
      case 'validated':
        this.currentStep = 4;
        this.documentsUploaded = true;
        this.imagesUploaded = true;
        break;
    }
    this.navigateToStep(this.currentStep);
  }

  navigateToStep(step: number): void {
    this.currentStep = step;
    const stepRoute = this.steps[step - 1]?.route || 'create';
    
    if (this.claimId) {
      // Include claimId in route when navigating
      this.router.navigate(['/claim-validator', this.claimId, stepRoute], { replaceUrl: true });
    } else {
      // For new claims without ID, navigate without ID
      this.router.navigate(['/claim-validator', stepRoute], { replaceUrl: true });
    }
  }

  canNavigateToStep(step: number): boolean {
    if (step <= this.currentStep) return true;
    
    // Check prerequisites
    if (step === 2) return !!this.claimId;
    if (step === 3) return this.documentsUploaded;
    if (step === 4) return this.imagesUploaded;
    
    return false;
  }

  // Step 1: Create Claim - POST /api/v1/claims/create
  createClaim(): void {
    this.isCreatingClaim = true;

    // Use claimNumber and description from form, or empty strings if not provided
    const claimNumberValue = this.claimNumber?.trim() || undefined;
    const descriptionValue = this.description?.trim() || undefined;

    this.claimsService.createClaim(claimNumberValue, descriptionValue).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const claimData = response.data as any;
          // Map backend format: _id to id
          this.claimId = claimData._id || claimData.id;
          this.currentClaim = {
            id: this.claimId,
            claim_number: claimData.claim_number,
            description: claimData.description,
            status: claimData.status || 'created',
            createdAt: claimData.CreatedOn || claimData.createdAt,
            documents: claimData.documents || [],
            images: claimData.images || []
          } as any;
          this.isCreatingClaim = false;
          this.navigateToStep(2);
        } else {
          const errorMsg = response.error || 'Failed to create claim';
          console.error('Create claim error:', errorMsg);
          alert(errorMsg);
          this.isCreatingClaim = false;
        }
      },
      error: (error) => {
        console.error('Error creating claim:', error);
        // Extract error message from FastAPI response
        let errorMessage = 'Failed to create claim. Please try again.';
        if (error.error) {
          if (error.error.detail) {
            // FastAPI error format: { detail: { error: "...", success: false, data: null } }
            if (typeof error.error.detail === 'string') {
              errorMessage = error.error.detail;
            } else if (error.error.detail.error) {
              errorMessage = error.error.detail.error;
            } else if (error.error.detail.message) {
              errorMessage = error.error.detail.message;
            }
          } else if (error.error.error) {
            errorMessage = error.error.error;
          } else if (error.error.message) {
            errorMessage = error.error.message;
          }
        }
        alert(errorMessage);
        this.isCreatingClaim = false;
      }
    });
  }

  // Step 2: Upload Documents - POST /api/v1/claims/{claim_id}/documents
  uploadDocuments(): void {
    if (!this.claimId) {
      alert('Please create a claim first');
      return;
    }

    const requiredDocs = [this.policyDocument, this.claimForm, this.drivingLicense, this.aadhaar, this.pan];
    if (requiredDocs.some(doc => !doc)) {
      alert('Please upload all required documents (Policy, Claim Form, Driving License, Aadhaar, and PAN)');
      return;
    }

    this.isUploadingDocuments = true;

    // Map document types to API format
    const documentMappings = [
      { file: this.policyDocument, type: 'policy' },
      { file: this.claimForm, type: 'claim_form' },
      { file: this.drivingLicense, type: 'driving_license' },
      { file: this.aadhaar, type: 'aadhaar' },
      { file: this.pan, type: 'pan' }
    ];

    // Upload optional repair estimate if provided
    if (this.repairEstimate) {
      documentMappings.push({ file: this.repairEstimate, type: 'repair_estimate' });
    }

    // Upload all documents sequentially
    const uploadPromises = documentMappings
      .filter(mapping => mapping.file)
      .map(mapping => 
        firstValueFrom(this.claimsService.uploadDocument(this.claimId!, mapping.type, mapping.file!))
      );

    Promise.all(uploadPromises).then((responses) => {
      const allSuccessful = responses.every(r => r?.success);
      if (allSuccessful) {
        this.documentsUploaded = true;
        if (this.currentClaim) {
          this.currentClaim.status = 'documents_uploaded';
        }
        this.isUploadingDocuments = false;
        this.navigateToStep(3);
      } else {
        const errors = responses.filter(r => !r?.success).map(r => r?.error).join(', ');
        alert(`Failed to upload some documents: ${errors}`);
        this.isUploadingDocuments = false;
      }
    }).catch((error) => {
      console.error('Error uploading documents:', error);
      alert('Failed to upload documents. Please try again.');
      this.isUploadingDocuments = false;
    });
  }

  // Step 3: Upload Images - POST /api/v1/claims/{claim_id}/images
  uploadImages(): void {
    if (!this.claimId) {
      alert('Please create a claim first');
      return;
    }

    if (this.carImages.length === 0) {
      alert('Please upload car photos');
      return;
    }

    this.isUploadingImages = true;

    // Upload all images sequentially
    const uploadPromises = this.carImages.map((image, index) => 
      firstValueFrom(this.claimsService.uploadImage(
        this.claimId!,
        image,
        `Image ${index + 1}`
      ))
    );

    Promise.all(uploadPromises).then((responses) => {
      const allSuccessful = responses.every(r => r?.success);
      if (allSuccessful) {
        this.imagesUploaded = true;
        if (this.currentClaim) {
          this.currentClaim.status = 'images_uploaded';
        }
        this.isUploadingImages = false;
        this.navigateToStep(4);
      } else {
        const errors = responses.filter(r => !r?.success).map(r => r?.error).join(', ');
        alert(`Failed to upload some images: ${errors}`);
        this.isUploadingImages = false;
      }
    }).catch((error) => {
      console.error('Error uploading images:', error);
      alert('Failed to upload images. Please try again.');
      this.isUploadingImages = false;
    });
  }

  // Step 4: Validate Claim - POST /api/v1/claims/{claim_id}/validate
  validateClaim(): void {
    if (!this.claimId) {
      alert('Please create a claim first');
      return;
    }

    // Check if documents and images exist instead of just flags
    const hasDocuments = (this.currentClaim?.documents && this.currentClaim.documents.length > 0) || this.documentsUploaded;
    const hasImages = (this.currentClaim?.images && this.currentClaim.images.length > 0) || this.imagesUploaded;

    if (!hasDocuments || !hasImages) {
      alert('Please complete all previous steps (upload documents and images)');
      return;
    }

    this.isValidating = true;

    if (this.currentClaim) {
      this.currentClaim.status = 'validating';
    }

    this.claimsService.validateClaim(this.claimId).subscribe({
      next: (response) => {
        if (response.success) {
          // After validation, fetch updated claim details
          this.fetchClaimDetails();
        } else {
          alert(response.error || 'Failed to validate claim');
          this.isValidating = false;
          if (this.currentClaim) {
            this.currentClaim.status = this.currentClaim.status === 'validating' ? 'images_uploaded' : this.currentClaim.status;
          }
        }
      },
      error: (error) => {
        console.error('Error validating claim:', error);
        let errorMessage = 'Failed to validate claim. Please try again.';
        if (error.error) {
          if (error.error.detail) {
            if (typeof error.error.detail === 'string') {
              errorMessage = error.error.detail;
            } else if (error.error.detail.error) {
              errorMessage = error.error.detail.error;
            } else if (error.error.detail.message) {
              errorMessage = error.error.detail.message;
            }
          } else if (error.error.error) {
            errorMessage = error.error.error;
          } else if (error.error.message) {
            errorMessage = error.error.message;
          }
        }
        alert(errorMessage);
        this.isValidating = false;
        if (this.currentClaim) {
          this.currentClaim.status = this.currentClaim.status === 'validating' ? 'images_uploaded' : this.currentClaim.status;
        }
      }
    });
  }

  // Get Claim - GET /api/v1/claims/{claim_id}
  fetchClaimDetails(): void {
    if (!this.claimId) return;

    this.claimsService.getClaim(this.claimId).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const claimData = response.data as any;
          
          // Extract policy details from policy document
          let policyDetails = null;
          const policyDoc = claimData.documents?.find((doc: any) => doc.document_type === 'policy');
          if (policyDoc?.extracted_data) {
            const policyData = policyDoc.extracted_data;
            policyDetails = {
              name: policyData.insured_name || 'N/A',
              vehicleRegNo: policyData.vehicle_registration || 'N/A',
              policyStart: policyData.policy_start_date ? new Date(policyData.policy_start_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A',
              policyExpiry: policyData.policy_expiry_date ? new Date(policyData.policy_expiry_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'
            };
          }
          
          // Map validation object to validationResults array
          let validationResults: ValidationResult[] = [];
          if (claimData.validation) {
            const validation = claimData.validation;
            
            if (validation.name_validation) {
              validationResults.push({
                name: 'Name Validation',
                status: validation.name_validation.is_valid ? 'passed' : 'mismatch',
                confidence: validation.name_validation.confidence || 0,
                mismatches: validation.name_validation.mismatches || []
              });
            }
            
            if (validation.vehicle_validation) {
              validationResults.push({
                name: 'Vehicle Validation',
                status: validation.vehicle_validation.is_valid ? 'passed' : 'mismatch',
                confidence: validation.vehicle_validation.confidence || 0,
                mismatches: validation.vehicle_validation.mismatches || []
              });
            }
            
            if (validation.date_validation) {
              validationResults.push({
                name: 'Date Validation',
                status: validation.date_validation.is_valid ? 'passed' : 'review',
                confidence: validation.date_validation.confidence || 0,
                mismatches: validation.date_validation.mismatches || []
              });
            }
            
            if (validation.damage_validation) {
              // Use is_valid if available, otherwise use matches_description, default to 'review'
              const isValid = validation.damage_validation.is_valid !== undefined 
                ? validation.damage_validation.is_valid 
                : (validation.damage_validation.matches_description || false);
              validationResults.push({
                name: 'Damage Validation',
                status: isValid ? 'passed' : 'review',
                confidence: validation.damage_validation.confidence || 0,
                mismatches: validation.damage_validation.mismatches || []
              });
            }
          }
          
          // Map backend format to component format
          // Preserve 'validated' status as is, since template checks for both 'completed' and 'validated'
          const mappedClaim = {
            id: claimData._id || claimData.id,
            claim_number: claimData.claim_number,
            description: claimData.description,
            status: (claimData.status === 'validated' ? 'validated' : (claimData.status || 'created')) as any,
            createdAt: claimData.CreatedOn || claimData.createdAt,
            documents: claimData.documents || [],
            images: claimData.images || [],
            validationResults: validationResults,
            policyDetails: policyDetails,
            overallConfidence: claimData.validation?.overall_confidence || 0,
            manualReviewRequired: claimData.validation?.overall_valid === false ? 1 : 0
          } as any;
          
          this.currentClaim = mappedClaim;
          this.validationResults = validationResults;
          this.policyDetails = policyDetails;
          this.overallConfidence = mappedClaim.overallConfidence;
          this.manualReviewRequired = mappedClaim.manualReviewRequired;
          this.validationIssues = claimData.validation?.issues || [];
          this.validationWarnings = claimData.validation?.warnings || [];
          this.damageAnalysis = claimData.validation?.damage_validation || null;
          
          // Set upload flags based on documents and images
          if (mappedClaim.documents && mappedClaim.documents.length > 0) {
            this.documentsUploaded = true;
          }
          if (mappedClaim.images && mappedClaim.images.length > 0) {
            this.imagesUploaded = true;
          }
        } else {
          alert(response.error || 'Failed to fetch claim details');
        }
        this.isValidating = false;
      },
      error: (error) => {
        console.error('Error fetching claim details:', error);
        alert('Failed to fetch claim details. Please try again.');
        this.isValidating = false;
      }
    });
  }

  onFileSelected(event: Event, type: string): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      switch (type) {
        case 'policy':
          this.policyDocument = file;
          break;
        case 'claim':
          this.claimForm = file;
          break;
        case 'license':
          this.drivingLicense = file;
          break;
        case 'aadhaar':
          this.aadhaar = file;
          break;
        case 'pan':
          this.pan = file;
          break;
        case 'repair':
          this.repairEstimate = file;
          break;
        case 'images':
          this.carImages = Array.from(input.files);
          break;
      }
    }
  }

  removeFile(type: string): void {
    switch (type) {
      case 'policy':
        this.policyDocument = null;
        break;
      case 'claim':
        this.claimForm = null;
        break;
      case 'license':
        this.drivingLicense = null;
        break;
      case 'aadhaar':
        this.aadhaar = null;
        break;
      case 'pan':
        this.pan = null;
        break;
      case 'repair':
        this.repairEstimate = null;
        break;
      case 'images':
        this.carImages = [];
        break;
    }
  }

  getFileName(type: string): string {
    switch (type) {
      case 'policy':
        return this.policyDocument?.name || '';
      case 'claim':
        return this.claimForm?.name || '';
      case 'license':
        return this.drivingLicense?.name || '';
      case 'aadhaar':
        return this.aadhaar?.name || '';
      case 'pan':
        return this.pan?.name || '';
      case 'repair':
        return this.repairEstimate?.name || '';
      default:
        return '';
    }
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'passed':
        return '✓';
      case 'review':
        return '▲';
      case 'mismatch':
        return '▲';
      default:
        return '';
    }
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'passed':
        return 'status-passed';
      case 'review':
        return 'status-review';
      case 'mismatch':
        return 'status-mismatch';
      default:
        return '';
    }
  }

  formatConfidence(confidence: number): string {
    return confidence.toFixed(3);
  }

  formatManualReviewRequired(value: number): string {
    return value ? 'Yes' : 'No';
  }

  goToClaimsList(): void {
    this.router.navigate(['/claims']);
  }

  get isProcessing(): boolean {
    return this.isCreatingClaim || this.isUploadingDocuments || this.isUploadingImages || this.isValidating || this.isFetchingClaim;
  }
}
